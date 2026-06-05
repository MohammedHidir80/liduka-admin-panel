'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  FolderTree,
  TrendingUp,
  DollarSign,
  Package,
  Plus,
  ChevronDown,
  ChevronRight,
  Layers3,
  ShoppingBag,
  Save,
  X,
  AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'

// ======================================================
// HELPERS
// ======================================================

const formatGHS = (amount) => {
  return `₵${Number(amount || 0).toLocaleString()}`
}

const slugify = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w-]+/g, '')
}

// ======================================================
// MAIN PAGE
// ======================================================

export default function CategoriesPage() {

  // ======================================================
  // STATES (unchanged)
  // ======================================================

  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [expandedCategory, setExpandedCategory] = useState(null)

  // Create Category
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)

  const [categoryName, setCategoryName] = useState('')
  const [categoryImage, setCategoryImage] = useState('')

  // Add Subcategory
  const [showSubModal, setShowSubModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [subName, setSubName] = useState('')
  const [addingSub, setAddingSub] = useState(false)

  // ======================================================
  // FETCH DATA (unchanged)
  // ======================================================

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const categorySnap = await getDocs(collection(db, 'categories'))

      const categoriesData = categorySnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))

      const productSnap = await getDocs(collection(db, 'products'))

      const products = productSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))

      const ordersSnap = await getDocs(collection(db, 'orders'))

      const orders = ordersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))

      const categoryStats = {}

      for (const category of categoriesData) {
        categoryStats[category.id] = {
          totalSales: 0,
          totalRevenue: 0,
          totalOrders: 0,
          totalProducts: 0
        }
      }

      for (const product of products) {
        const category = product.category
        if (!categoryStats[category]) {
          categoryStats[category] = {
            totalSales: 0,
            totalRevenue: 0,
            totalOrders: 0,
            totalProducts: 0
          }
        }
        categoryStats[category].totalProducts += 1
      }

      for (const order of orders) {
        const product = products.find((p) => p.id === order.productId)
        if (!product) continue
        const category = product.category
        if (!categoryStats[category]) {
          categoryStats[category] = {
            totalSales: 0,
            totalRevenue: 0,
            totalOrders: 0,
            totalProducts: 0
          }
        }
        categoryStats[category].totalSales += Number(order.quantity || 1)
        categoryStats[category].totalRevenue += Number(
          order.finalTotal ||
          order.total ||
          order.unitPrice ||
          0
        )
        categoryStats[category].totalOrders += 1
      }

      const merged = categoriesData.map((category) => ({
        ...category,
        totalSales: categoryStats[category.id]?.totalSales || 0,
        totalRevenue: categoryStats[category.id]?.totalRevenue || 0,
        totalOrders: categoryStats[category.id]?.totalOrders || 0,
        totalProducts: categoryStats[category.id]?.totalProducts || 0
      }))

      merged.sort((a, b) => b.totalSales - a.totalSales)

      setCategories(merged)

    } catch (err) {
      console.error(err)
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  // ======================================================
  // CREATE CATEGORY (unchanged)
  // ======================================================

  const createCategory = async () => {
    if (!categoryName.trim()) {
      return toast.error('Category name required')
    }
    try {
      setCreatingCategory(true)
      const categoryId = categoryName.trim()
      await setDoc(doc(db, 'categories', categoryId), {
        imageUrl: categoryImage || '',
        subcategories: [],
        totalSales: 0,
        totalRevenue: 0,
        totalOrders: 0,
        totalProducts: 0,
        createdAt: serverTimestamp()
      })
      toast.success('Category created')
      setCategoryName('')
      setCategoryImage('')
      setShowCreateCategory(false)
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error(err.message)
    } finally {
      setCreatingCategory(false)
    }
  }

  // ======================================================
  // ADD SUBCATEGORY (unchanged)
  // ======================================================

  const addSubcategory = async () => {
    if (!subName.trim()) {
      return toast.error('Subcategory name required')
    }
    try {
      setAddingSub(true)
      await updateDoc(
        doc(db, 'categories', selectedCategory.id),
        {
          subcategories: arrayUnion({
            id: slugify(subName),
            name: subName.trim()
          })
        }
      )
      toast.success('Subcategory added')
      setSubName('')
      setShowSubModal(false)
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error(err.message)
    } finally {
      setAddingSub(false)
    }
  }

  // ======================================================
  // TOTALS (unchanged)
  // ======================================================

  const totalRevenue = categories.reduce(
    (sum, cat) => sum + (cat.totalRevenue || 0),
    0
  )

  const totalSales = categories.reduce(
    (sum, cat) => sum + (cat.totalSales || 0),
    0
  )

  const totalProducts = categories.reduce(
    (sum, cat) => sum + (cat.totalProducts || 0),
    0
  )

  const bestCategory = categories[0]

  // ======================================================
  // LOADING (styled with card skeleton)
  // ======================================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-40 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  // ======================================================
  // UI (styling updated to match dashboard)
  // ======================================================

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Categories Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage marketplace categories and subcategories
          </p>
        </div>
        <button
          onClick={() => setShowCreateCategory(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <FolderTree className="w-8 h-8 text-blue-500 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Categories</p>
          <p className="text-3xl font-bold dark:text-white">{categories.length}</p>
        </div>
        <div className="card p-6">
          <ShoppingBag className="w-8 h-8 text-green-500 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Products</p>
          <p className="text-3xl font-bold dark:text-white">{totalProducts}</p>
        </div>
        <div className="card p-6">
          <TrendingUp className="w-8 h-8 text-orange-500 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Sales</p>
          <p className="text-3xl font-bold dark:text-white">{totalSales}</p>
        </div>
        <div className="card p-6">
          <DollarSign className="w-8 h-8 text-purple-500 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Revenue</p>
          <p className="text-3xl font-bold dark:text-white">{formatGHS(totalRevenue)}</p>
        </div>
      </div>

      {/* BEST PERFORMING CATEGORY */}
      {bestCategory && (
        <div className="card p-6 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">🏆 Best Performing Category</p>
              <h2 className="text-3xl font-bold mt-2 dark:text-white">{bestCategory.id}</h2>
              <div className="flex flex-wrap gap-4 mt-3 text-sm dark:text-gray-300">
                <span>{bestCategory.totalSales} Sales</span>
                <span>{bestCategory.totalOrders} Orders</span>
                <span className="text-green-600 font-semibold">
                  {formatGHS(bestCategory.totalRevenue)}
                </span>
              </div>
            </div>
            <TrendingUp className="w-16 h-16 text-orange-500" />
          </div>
        </div>
      )}

      {/* CATEGORIES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {categories.map((category) => (
          <div key={category.id} className="card overflow-hidden">
            {/* HEADER BUTTON */}
            <button
              onClick={() => setExpandedCategory(
                expandedCategory === category.id ? null : category.id
              )}
              className="w-full text-left p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                    {category.imageUrl ? (
                      <Image
                        src={category.imageUrl}
                        alt={category.id}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FolderTree className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div>
                    <h3 className="font-bold text-xl dark:text-white">{category.id}</h3>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {category.totalProducts} Products
                      </span>
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {category.totalSales} Sales
                      </span>
                      <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        {category.totalOrders} Orders
                      </span>
                    </div>
                    <p className="text-green-600 font-semibold mt-3">
                      {formatGHS(category.totalRevenue)}
                    </p>
                  </div>
                </div>
                {expandedCategory === category.id ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {/* EXPANDED CONTENT – Subcategories */}
            {expandedCategory === category.id && (
              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 p-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2 dark:text-white">
                      <Layers3 className="w-4 h-4" />
                      Subcategories
                    </h4>
                    <button
                      onClick={() => {
                        setSelectedCategory(category)
                        setShowSubModal(true)
                      }}
                      className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    >
                      + Add
                    </button>
                  </div>
                  {category.subcategories?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {category.subcategories.map((sub) => (
                        <span
                          key={sub.id}
                          className="px-3 py-1 rounded-full bg-white dark:bg-gray-700 text-sm shadow-sm dark:text-gray-200"
                        >
                          {sub.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <AlertCircle className="w-4 h-4" />
                      No subcategories yet
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CREATE CATEGORY MODAL */}
      {showCreateCategory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold dark:text-white">Create Category</h2>
              <button onClick={() => setShowCreateCategory(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium dark:text-gray-300">Category Name</label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Fashion"
                  className="input"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium dark:text-gray-300">Image URL</label>
                <input
                  type="text"
                  value={categoryImage}
                  onChange={(e) => setCategoryImage(e.target.value)}
                  placeholder="https://..."
                  className="input"
                />
              </div>
              <button
                onClick={createCategory}
                disabled={creatingCategory}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {creatingCategory ? 'Creating...' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SUBCATEGORY MODAL */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold dark:text-white">Add Subcategory</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedCategory?.id}</p>
              </div>
              <button onClick={() => setShowSubModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium dark:text-gray-300">Subcategory Name</label>
                <input
                  type="text"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="Men"
                  className="input"
                />
              </div>
              <button
                onClick={addSubcategory}
                disabled={addingSub}
                className="btn-primary w-full"
              >
                {addingSub ? 'Adding...' : 'Add Subcategory'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}