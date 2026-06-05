'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import Image from 'next/image'
import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    doc,
    getDoc
} from 'firebase/firestore'
import { Dialog, Transition } from '@headlessui/react'
import {
    Package,
    Search,
    Eye,
    RefreshCw,
    Filter,
    Star,
    MessageCircle,
    XCircle,
    Image as ImageIcon,
    Truck,
    CheckCircle,
    AlertCircle,
    TrendingUp,
    DollarSign
} from 'lucide-react'
import { db } from '@/lib/firebase'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'

// ------------------------------
// Helpers
// ------------------------------
const formatGHS = (amount) => `₵${Number(amount || 0).toLocaleString()}`
const formatDate = (date) => {
    if (!date) return 'N/A'
    try {
        return new Date(date).toLocaleString()
    } catch {
        return 'N/A'
    }
}

// ------------------------------
// Custom hook to fetch products with pagination and aggregate ratings
// ------------------------------
function useProducts(categoryFilter, statusFilter, refreshKey) {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [hasMore, setHasMore] = useState(true)
    const [lastDoc, setLastDoc] = useState(null)
    const [totalProducts, setTotalProducts] = useState(0)
    const [stats, setStats] = useState({ total: 0, inStock: 0, outOfStock: 0, totalValue: 0 })

    // Fetch all comments once to compute ratings per product (could be optimized, but fine for <1000 products)
    // Better: store aggregate in product doc, but we'll compute on the fly.
    const fetchComments = useCallback(async () => {
        const commentsSnap = await getDocs(collection(db, 'comments'))
        const commentMap = new Map() // productId -> { totalRating, count, comments: [] }
        commentsSnap.docs.forEach(doc => {
            const data = doc.data()
            const productId = data.productId
            if (!productId) return
            if (!commentMap.has(productId)) {
                commentMap.set(productId, { totalRating: 0, count: 0, comments: [] })
            }
            const entry = commentMap.get(productId)
            entry.totalRating += (data.rating || 0)
            entry.count += 1
            entry.comments.push({ id: doc.id, ...data, createdAt: data.createdAt?.toDate?.() || data.createdAt })
        })
        return commentMap
    }, [])

    const loadProducts = useCallback(async (reset = false) => {
        setLoading(true)
        try {
            // Build constraints
            let constraints = []
            if (categoryFilter !== 'all') {
                constraints.push(where('category', '==', categoryFilter))
            }
            if (statusFilter !== 'all') {
                constraints.push(where('status', '==', statusFilter))
            }
            constraints.push(orderBy('createdAt', 'desc'))
            constraints.push(limit(20))
            if (!reset && lastDoc) {
                constraints.push(startAfter(lastDoc))
            }

            const q = query(collection(db, 'products'), ...constraints)
            const snapshot = await getDocs(q)
            const productsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
                stockUpdatedAt: doc.data().stockUpdatedAt?.toDate?.() || doc.data().stockUpdatedAt
            }))

            // Fetch comments and enrich products with rating data
            const commentMap = await fetchComments()
            const enrichedProducts = productsData.map(p => {
                const ratingData = commentMap.get(p.id) || { totalRating: 0, count: 0, comments: [] }
                return {
                    ...p,
                    avgRating: ratingData.count > 0 ? (ratingData.totalRating / ratingData.count).toFixed(1) : 0,
                    ratingCount: ratingData.count,
                    comments: ratingData.comments
                }
            })

            if (reset) {
                setProducts(enrichedProducts)
            } else {
                setProducts(prev => [...prev, ...enrichedProducts])
            }
            setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null)
            setHasMore(snapshot.docs.length === 20)

            // Also fetch total count and stats (once, not on every load)
            if (reset) {
                const allProductsSnap = await getDocs(collection(db, 'products'))
                const allProducts = allProductsSnap.docs.map(d => d.data())
                const inStock = allProducts.filter(p => p.inStock === true && p.status === 'active').length
                const outOfStock = allProducts.filter(p => p.inStock === false || p.status !== 'active').length
                const totalValue = allProducts.reduce((sum, p) => sum + (p.price || 0), 0)
                setStats({ total: allProductsSnap.size, inStock, outOfStock, totalValue })
                setTotalProducts(allProductsSnap.size)
            }
        } catch (err) {
            console.error(err)
            toast.error('Failed to load products')
        } finally {
            setLoading(false)
        }
    }, [categoryFilter, statusFilter, lastDoc, fetchComments])

    useEffect(() => {
        setLastDoc(null)
        loadProducts(true)
    }, [categoryFilter, statusFilter, loadProducts]) 

    const loadMore = () => loadProducts(false)

    // Refresh function to reload from scratch
    const refresh = () => {
        setLastDoc(null)
        loadProducts(true)
    }

    return { products, loading, hasMore, loadMore, refresh, stats, totalProducts }
}

// ------------------------------
// Product Detail Modal
// ------------------------------
function ProductModal({ product, isOpen, onClose }) {
    const [activeTab, setActiveTab] = useState('details')
    if (!product) return null

    const totalStock = product.variants
        ? product.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : (product.stock || 0)

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all flex flex-col max-h-[90vh]">
                                {/* Header */}
                                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                                    <Dialog.Title className="text-xl font-bold dark:text-white">
                                        {product.name}
                                    </Dialog.Title>
                                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                                        <XCircle className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
                                    {['details', 'variants', 'comments'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={cn(
                                                "px-4 py-2 text-sm font-medium capitalize transition-colors",
                                                activeTab === tab
                                                    ? "text-primary-600 border-b-2 border-primary-600"
                                                    : "text-gray-500 hover:text-gray-700"
                                            )}
                                        >
                                            {tab === 'details' && 'Product Details'}
                                            {tab === 'variants' && `Variants (${product.variants?.length || 0})`}
                                            {tab === 'comments' && `Comments (${product.ratingCount || 0})`}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Panels */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {activeTab === 'details' && (
                                        <>
                                            {/* Images */}
                                            {product.images && product.images.length > 0 && (
                                                <div>
                                                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                                                        <ImageIcon className="w-4 h-4" /> Images
                                                    </h4>
                                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                                        {product.images.map((img, idx) => (
                                                            <div key={idx} className="relative w-32 h-32 flex-shrink-0">
                                                                <Image
                                                                    src={img}
                                                                    alt={`${product.name} - ${idx + 1}`}
                                                                    fill
                                                                    className="rounded-lg object-cover"
                                                                    unoptimized
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-500">Category</p>
                                                    <p className="font-medium">{product.category}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Subcategory</p>
                                                    <p className="font-medium">{product.subcategory || product.subcategories?.[0] || '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Price</p>
                                                    <p className="font-semibold text-green-600">{formatGHS(product.price)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Stock</p>
                                                    <p className="font-medium">{totalStock} units</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Status</p>
                                                    <span className={cn(
                                                        "inline-block px-2 py-1 text-xs rounded-full",
                                                        product.status === 'active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                    )}>
                                                        {product.status}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">In Stock</p>
                                                    <span className={cn(
                                                        "inline-block px-2 py-1 text-xs rounded-full",
                                                        product.inStock ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                    )}>
                                                        {product.inStock ? 'Yes' : 'No'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Vendor</p>
                                                    <p className="font-medium">{product.vendorName || product.vendorId}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Region</p>
                                                    <p className="font-medium">{product.region || product.city}</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <p className="text-xs text-gray-500">Description</p>
                                                    <p className="text-sm">{product.description || 'No description'}</p>
                                                </div>
                                            </div>

                                            {/* Rating summary */}
                                            <div className="border-t pt-4">
                                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                                    <Star className="w-4 h-4 text-yellow-500" /> Rating & Reviews
                                                </h4>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-2xl font-bold">{product.avgRating || 0}</span>
                                                        <span className="text-gray-500">/5</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                            <Star key={star} className={cn(
                                                                "w-4 h-4",
                                                                star <= (product.avgRating || 0) ? "fill-yellow-500 text-yellow-500" : "text-gray-300"
                                                            )} />
                                                        ))}
                                                    </div>
                                                    <span className="text-sm text-gray-500">({product.ratingCount || 0} reviews)</span>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {activeTab === 'variants' && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                                    <tr>
                                                        <th className="p-2 text-left">Color</th>
                                                        <th className="p-2 text-left">Size</th>
                                                        <th className="p-2 text-left">Stock</th>
                                                        <th className="p-2 text-left">Variant ID</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {product.variants?.map((v, i) => (
                                                        <tr key={i} className="border-t">
                                                            <td className="p-2">{v.color || '—'}</td>
                                                            <td className="p-2">{v.size || '—'}</td>
                                                            <td className="p-2">{v.stock}</td>
                                                            <td className="p-2 text-xs font-mono">{v.variantId}</td>
                                                        </tr>
                                                    ))}
                                                    {(!product.variants || product.variants.length === 0) && (
                                                        <tr><td colSpan="4" className="p-4 text-center text-gray-500">No variants</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {activeTab === 'comments' && (
                                        <div className="space-y-4">
                                            {product.comments?.length === 0 ? (
                                                <div className="text-center text-gray-500 py-8">No comments yet</div>
                                            ) : (
                                                product.comments?.map(comment => (
                                                    <div key={comment.id} className="border-b pb-4">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <p className="font-medium">{comment.name || 'Anonymous'}</p>
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    {[1, 2, 3, 4, 5].map(star => (
                                                                        <Star key={star} className={cn(
                                                                            "w-3 h-3",
                                                                            star <= (comment.rating || 0) ? "fill-yellow-500 text-yellow-500" : "text-gray-300"
                                                                        )} />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-gray-500">{formatDate(comment.createdAt)}</p>
                                                        </div>
                                                        <p className="text-sm mt-2">{comment.text}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}

// ------------------------------
// Main Products Page
// ------------------------------
export default function ProductsPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)

    const { products, loading, hasMore, loadMore, refresh, stats, totalProducts } = useProducts(
        categoryFilter,
        statusFilter,
        refreshKey
    )

    // Filter by search term (local)
    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.vendorName?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Products</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Manage marketplace products, variants, and reviews
                    </p>
                </div>
                <button onClick={refresh} className="btn-secondary flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div><p className="text-sm text-gray-500">Total Products</p><p className="text-2xl font-bold">{stats.total}</p></div>
                        <Package className="w-8 h-8 text-primary-500" />
                    </div>
                </div>
                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div><p className="text-sm text-gray-500">In Stock</p><p className="text-2xl font-bold text-green-600">{stats.inStock}</p></div>
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                </div>
                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div><p className="text-sm text-gray-500">Out of Stock</p><p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p></div>
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                </div>
                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div><p className="text-sm text-gray-500">Total Inventory Value</p><p className="text-2xl font-bold">{formatGHS(stats.totalValue)}</p></div>
                        <DollarSign className="w-8 h-8 text-emerald-500" />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search by name, category, vendor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input pl-9"
                    />
                </div>
                <div className="relative w-48">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="input pl-9 appearance-none cursor-pointer"
                    >
                        <option value="all">All Categories</option>
                        <option value="Fabrics & Textiles">Fabrics & Textiles</option>
                        <option value="Fashion">Fashion</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Home">Home</option>
                        <option value="Beauty & Cosmetics">Beauty & Cosmetics</option>
                    </select>
                </div>
                <div className="relative w-48">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="input pl-9 appearance-none cursor-pointer"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {loading && filteredProducts.length === 0 ? (
                    [...Array(8)].map((_, i) => (
                        <div key={i} className="card p-4 animate-pulse">
                            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3" />
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                        </div>
                    ))
                ) : filteredProducts.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500">No products found</div>
                ) : (
                    filteredProducts.map(product => (
                        <div key={product.id} className="card overflow-hidden hover:shadow-lg transition-shadow">
                            {/* Image */}
                            <div className="relative h-48 bg-gray-100 dark:bg-gray-700">
                                {product.images?.[0] ? (
                                    <Image
                                        src={product.images[0]}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <Package className="w-12 h-12 text-gray-400" />
                                    </div>
                                )}
                                {/* Status badge */}
                                <span className={cn(
                                    "absolute top-2 right-2 px-2 py-1 text-xs rounded-full",
                                    product.status === 'active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                )}>
                                    {product.status}
                                </span>
                            </div>
                            {/* Content */}
                            <div className="p-4">
                                <h3 className="font-semibold text-lg line-clamp-1">{product.name}</h3>
                                <p className="text-sm text-gray-500 mb-2">{product.category}</p>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xl font-bold text-green-600">{formatGHS(product.price)}</span>
                                    <span className="text-sm text-gray-500">Stock: {product.stock || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                        <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                                        <span className="text-sm font-medium">{product.avgRating || 0}</span>
                                        <span className="text-xs text-gray-500">({product.ratingCount || 0})</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedProduct(product)
                                            setModalOpen(true)
                                        }}
                                        className="text-primary-600 hover:text-primary-700 flex items-center gap-1 text-sm"
                                    >
                                        <Eye className="w-4 h-4" /> Details
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Load More */}
            {hasMore && filteredProducts.length < totalProducts && (
                <div className="flex justify-center pt-4">
                    <button onClick={loadMore} disabled={loading} className="btn-secondary px-8">
                        {loading ? 'Loading...' : 'Load More'}
                    </button>
                </div>
            )}

            {/* Product Modal */}
            <ProductModal
                product={selectedProduct}
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </div>
    )
}