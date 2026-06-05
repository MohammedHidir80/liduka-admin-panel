'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import StatCard from '@/components/ui/StatCard'
import ChartCard from '@/components/ui/ChartCard'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import {
  Users,
  Store,
  Package,
  ShoppingCart,
  DollarSign,
  Truck,
  TrendingUp,
  Crown,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, subDays, subMonths } from 'date-fns'

// Helper to format Ghana Cedis
const formatGHS = (amount) => `₵${amount.toLocaleString()}`

// Custom hook to fetch dashboard data
function useDashboardData() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVendors: 0,
    totalBuyers: 0,
    totalDeliveryPartners: 0,
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
    pendingPayouts: 0,
  })
  const [recentOrders, setRecentOrders] = useState([])
  const [recentUsers, setRecentUsers] = useState([]) // only vendors & buyers
  const [mostPurchasedProducts, setMostPurchasedProducts] = useState([])
  const [revenueData, setRevenueData] = useState([])
  const [orderTrendData, setOrderTrendData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function fetchData() {
      if (!isMounted) return
      setLoading(true)
      setError(null)

      try {
        // 1. Fetch users
        const usersSnapshot = await getDocs(collection(db, 'users'))
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        const vendors = users.filter(u => u.role === 'vendor')
        const buyers = users.filter(u => u.role === 'buyer')
        const deliveryPartners = users.filter(u => u.role === 'deliveryPartner')

        // 2. Fetch products
        const productsSnapshot = await getDocs(collection(db, 'products'))

        // 3. Fetch orders
        const ordersSnapshot = await getDocs(collection(db, 'orders'))
        const orders = ordersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        }))

        const pendingOrders = orders.filter(o => o.status === 'pending')
        const deliveredOrders = orders.filter(o => o.status === 'delivered')
        const cancelledOrders = orders.filter(o => o.status === 'cancelled')

        // 4. Fetch platform wallet balance (total revenue)
        const walletQuery = query(collection(db, 'wallets'), where('type', '==', 'platform'))
        const walletSnapshot = await getDocs(walletQuery)
        let platformBalance = 0
        if (!walletSnapshot.empty) {
          const walletDoc = walletSnapshot.docs[0]
          platformBalance = walletDoc.data().balance || 0
        }

        // 5. Fetch pending payouts from transactions
        const transactionsSnapshot = await getDocs(
          query(collection(db, 'transactions'), where('status', '==', 'pending'))
        )
        const pendingPayouts = transactionsSnapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0)

        if (isMounted) {
          setStats({
            totalUsers: users.length,
            totalVendors: vendors.length,
            totalBuyers: buyers.length,
            totalDeliveryPartners: deliveryPartners.length,
            totalProducts: productsSnapshot.size,
            totalOrders: orders.length,
            pendingOrders: pendingOrders.length,
            deliveredOrders: deliveredOrders.length,
            cancelledOrders: cancelledOrders.length,
            totalRevenue: platformBalance,
            pendingPayouts,
          })
        }

        // 6. Recent orders (last 5) – include productTitle
        const recentOrdersQuery = await getDocs(
          query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(5))
        )
        const recentOrdersData = recentOrdersQuery.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        }))
        if (isMounted) setRecentOrders(recentOrdersData)

        // 7. Recent users – only vendors & buyers (last 5 combined)
        const recentVendors = await getDocs(
          query(collection(db, 'users'), where('role', '==', 'vendor'), orderBy('createdAt', 'desc'), limit(5))
        )
        const recentBuyers = await getDocs(
          query(collection(db, 'users'), where('role', '==', 'buyer'), orderBy('createdAt', 'desc'), limit(5))
        )
        const combinedRecent = [
          ...recentVendors.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          ...recentBuyers.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
        if (isMounted) setRecentUsers(combinedRecent)

        // 8. Most purchased products (aggregate from orders)
        const productSales = new Map() // productId -> { title, totalQuantity }
        orders.forEach(order => {
          const productId = order.productId
          const title = order.productTitle || 'Unknown Product'
          const qty = order.quantity || 1
          if (productSales.has(productId)) {
            const existing = productSales.get(productId)
            existing.totalQuantity += qty
          } else {
            productSales.set(productId, { title, totalQuantity: qty })
          }
        })
        const sortedProducts = Array.from(productSales.values())
          .sort((a, b) => b.totalQuantity - a.totalQuantity)
          .slice(0, 5)
        if (isMounted) setMostPurchasedProducts(sortedProducts)

        // 9. Revenue data for last 7 days (from orders)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(new Date(), i)
          const dayOrders = orders.filter(o => {
            const orderDate = o.createdAt ? new Date(o.createdAt) : new Date()
            return format(orderDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
          })
          return {
            date: format(date, 'MMM dd'),
            revenue: dayOrders.reduce((sum, o) => sum + (o.total || o.totalAmount || 0), 0),
            orders: dayOrders.length,
          }
        }).reverse()
        if (isMounted) setRevenueData(last7Days)

        // 10. Order trend last 6 months (from orders)
        const last6Months = Array.from({ length: 6 }, (_, i) => {
          const date = subMonths(new Date(), i)
          const monthOrders = orders.filter(o => {
            const orderDate = o.createdAt ? new Date(o.createdAt) : new Date()
            return format(orderDate, 'MMM yyyy') === format(date, 'MMM yyyy')
          })
          return {
            month: format(date, 'MMM'),
            orders: monthOrders.length,
            revenue: monthOrders.reduce((sum, o) => sum + (o.total || o.totalAmount || 0), 0),
          }
        }).reverse()
        if (isMounted) setOrderTrendData(last6Months)

      } catch (err) {
        if (isMounted) {
          console.error('Error fetching dashboard data:', err)
          setError(err.message)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [])

  return {
    stats,
    recentOrders,
    recentUsers,
    mostPurchasedProducts,
    revenueData,
    orderTrendData,
    loading,
    error,
  }
}

export default function DashboardPage() {
  const {
    stats,
    recentOrders,
    recentUsers,
    mostPurchasedProducts,
    revenueData,
    orderTrendData,
    loading,
    error,
  } = useDashboardData()

  const statCards = [
    { title: 'Total Users', value: stats.totalUsers, icon: Users, color: 'from-blue-500 to-blue-600', change: '+12%' },
    { title: 'Total Vendors', value: stats.totalVendors, icon: Store, color: 'from-green-500 to-green-600', change: '+8%' },
    { title: 'Total Products', value: stats.totalProducts, icon: Package, color: 'from-purple-500 to-purple-600', change: '+15%' },
    { title: 'Total Orders', value: stats.totalOrders, icon: ShoppingCart, color: 'from-orange-500 to-orange-600', change: '+10%' },
    { title: 'Total Revenue', value: formatGHS(stats.totalRevenue), icon: DollarSign, color: 'from-yellow-500 to-yellow-600', change: '+23%' },
    { title: 'Pending Orders', value: stats.pendingOrders, icon: Truck, color: 'from-red-500 to-red-600', change: '-5%' },
    { title: 'Total Buyers', value: stats.totalBuyers, icon: Users, color: 'from-pink-500 to-pink-600', change: '+18%' },
    { title: 'Growth', value: '+27%', icon: TrendingUp, color: 'from-indigo-500 to-indigo-600', change: 'vs last month' },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <SkeletonLoader key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonLoader className="h-96 rounded-xl" />
          <SkeletonLoader className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="btn-primary mt-4"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Welcome back!.
        </p>
      </div> 
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Revenue Trend (Last 7 Days)">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `₵${value}`} />
              <Tooltip formatter={(value) => `₵${value}`} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        
        <ChartCard title="Order Analytics (Last 6 Months)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={orderTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" tickFormatter={(value) => `₵${value}`} />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
              <Tooltip formatter={(value, name) => name === 'revenue' ? `₵${value}` : value} />
              <Legend />
              <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name="Revenue (₵)" />
              <Bar yAxisId="right" dataKey="orders" fill="#10b981" name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      
      {/* Recent Data Tables + Most Purchased */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="card p-6 lg:col-span-1">
          <h3 className="text-lg font-semibold mb-4">Recent Orders</h3>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm">{order.productTitle || 'Product'}</p>
                  <p className="text-xs text-gray-500">Order #{order.id.slice(0, 8)}</p>
                  <p className="text-sm font-semibold mt-1">{formatGHS(order.total || order.totalAmount || 0)}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  order.status === 'delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {order.status}
                </span>
              </div>
            ))}
            {recentOrders.length === 0 && (
              <p className="text-center text-gray-500 py-4">No recent orders</p>
            )}
          </div>
        </div>
        
        {/* Recent Users (Vendors & Buyers) */}
        <div className="card p-6 lg:col-span-1">
          <h3 className="text-lg font-semibold mb-4">Recent Vendors & Buyers</h3>
          <div className="space-y-3">
            {recentUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <p className="font-medium">{user.fullName || 'N/A'}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <span className="text-xs capitalize px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-full">
                  {user.role}
                </span>
              </div>
            ))}
            {recentUsers.length === 0 && (
              <p className="text-center text-gray-500 py-4">No recent vendors/buyers</p>
            )}
          </div>
        </div>

        {/* Most Purchased Products */}
        <div className="card p-6 lg:col-span-1">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            Most Purchased Products
          </h3>
          <div className="space-y-3">
            {mostPurchasedProducts.map((product, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <p className="font-medium">{product.title}</p>
                  <p className="text-sm text-gray-500">{product.totalQuantity} units sold</p>
                </div>
                <div className="text-lg font-bold text-primary-600">
                  #{idx + 1}
                </div>
              </div>
            ))}
            {mostPurchasedProducts.length === 0 && (
              <p className="text-center text-gray-500 py-4">No purchase data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}