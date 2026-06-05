'use client'

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, Users, Package,
  ShoppingCart, Truck, Calendar, Award, Activity,
  RefreshCw, AlertCircle, FileText
} from 'lucide-react'
import { Store } from 'lucide-react'
import { format, subDays, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'

// Helper functions with 2 decimal places
const formatGHS = (amount) => `₵${Number(amount || 0).toFixed(2)}`
const formatNumber = (num) => num.toLocaleString()
const formatDate = (date) => {
  if (!date) return 'N/A'
  try { return format(new Date(date), 'PPP') } catch { return 'Invalid date' }
}

// Chart colors
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

// ------------------------------
// Custom hook for analytics data
// ------------------------------
function useAnalyticsData() {
  const [data, setData] = useState({
    revenueTrend: [],
    monthlyRevenue: [],
    userGrowth: [],
    topProducts: [],
    topVendors: [],
    orderStatusDistribution: [],
    deliveryMetrics: {
      totalDelivered: 0,
      totalPending: 0,
      totalFailed: 0,
      avgDeliveryTime: 0
    },
    platformMetrics: {
      totalUsers: 0,
      totalVendors: 0,
      totalBuyers: 0,
      totalDeliveryPartners: 0,
      totalProducts: 0,
      totalOrders: 0,
      totalRevenue: 0,
      avgOrderValue: 0
    },
    monthlyGrowth: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function fetchAnalytics() {
      setLoading(true)
      setError(null)
      try {
        const usersSnap = await getDocs(collection(db, 'users'))
        const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt }))

        const productsSnap = await getDocs(collection(db, 'products'))
        const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

        const ordersSnap = await getDocs(collection(db, 'orders'))
        const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt }))

        // Platform Metrics
        const vendors = users.filter(u => u.role === 'vendor')
        const buyers = users.filter(u => u.role === 'buyer')
        const deliveryPartners = users.filter(u => u.role === 'deliveryPartner')
        const totalOrders = orders.length
        const totalRevenue = orders.reduce((sum, o) => sum + (o.total || o.totalAmount || 0), 0)
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

        // Revenue Trends (last 30 days)
        const last30Days = Array.from({ length: 30 }, (_, i) => {
          const date = subDays(new Date(), i)
          const dayStr = format(date, 'yyyy-MM-dd')
          const dayOrders = orders.filter(o => {
            const oDate = o.createdAt ? new Date(o.createdAt) : new Date()
            return format(oDate, 'yyyy-MM-dd') === dayStr
          })
          const revenue = dayOrders.reduce((sum, o) => sum + (o.total || o.totalAmount || 0), 0)
          return { date: format(date, 'MMM dd'), revenue, orders: dayOrders.length }
        }).reverse()

        // Monthly revenue (last 6 months)
        const last6Months = Array.from({ length: 6 }, (_, i) => {
          const date = subMonths(new Date(), i)
          const monthStr = format(date, 'MMM yyyy')
          const monthOrders = orders.filter(o => {
            const oDate = o.createdAt ? new Date(o.createdAt) : new Date()
            return format(oDate, 'MMM yyyy') === monthStr
          })
          const revenue = monthOrders.reduce((sum, o) => sum + (o.total || o.totalAmount || 0), 0)
          return { month: format(date, 'MMM'), revenue, orders: monthOrders.length }
        }).reverse()

        // User Growth
        const now = new Date()
        const sixMonthsAgo = subMonths(now, 5)
        const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now })
        const userGrowth = months.map(month => {
          const start = startOfMonth(month)
          const end = endOfMonth(month)
          const newUsers = users.filter(u => {
            const created = u.createdAt ? new Date(u.createdAt) : null
            return created && created >= start && created <= end
          }).length
          return { month: format(month, 'MMM'), newUsers }
        })

        // Top Products by Revenue
        const productRevenue = new Map()
        for (const order of orders) {
          const prodId = order.productId
          if (!prodId) continue
          const amount = order.total || order.totalAmount || 0
          const qty = order.quantity || 1
          if (productRevenue.has(prodId)) {
            const existing = productRevenue.get(prodId)
            existing.revenue += amount
            existing.quantity += qty
          } else {
            const prod = products.find(p => p.id === prodId)
            productRevenue.set(prodId, {
              id: prodId,
              name: prod?.name || 'Unknown',
              revenue: amount,
              quantity: qty
            })
          }
        }
        const topProducts = Array.from(productRevenue.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)

        // Top Vendors by Revenue
        const vendorRevenue = new Map()
        for (const order of orders) {
          const vendorId = order.vendorId
          if (!vendorId) continue
          const amount = order.total || order.totalAmount || 0
          if (vendorRevenue.has(vendorId)) {
            const existing = vendorRevenue.get(vendorId)
            existing.revenue += amount
            existing.orders += 1
          } else {
            const vendor = users.find(u => u.id === vendorId)
            vendorRevenue.set(vendorId, {
              id: vendorId,
              name: vendor?.fullName || 'Unknown',
              revenue: amount,
              orders: 1
            })
          }
        }
        const topVendors = Array.from(vendorRevenue.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)

        // Order Status Distribution
        const statusCount = {}
        for (const order of orders) {
          const status = order.status || 'unknown'
          statusCount[status] = (statusCount[status] || 0) + 1
        }
        const orderStatusDistribution = Object.entries(statusCount).map(([name, value]) => ({ name, value }))

        // Delivery Metrics
        const deliveredOrders = orders.filter(o => o.status === 'delivered')
        const pendingOrders = orders.filter(o => o.status === 'pending')
        const failedOrders = orders.filter(o => o.status === 'cancelled' || o.status === 'failed')
        let avgDeliveryTime = 0
        const deliveredWithTimes = deliveredOrders.filter(o => o.deliveredAt && o.createdAt)
        if (deliveredWithTimes.length > 0) {
          const totalHours = deliveredWithTimes.reduce((sum, o) => {
            const delivered = new Date(o.deliveredAt)
            const created = new Date(o.createdAt)
            const hours = (delivered - created) / (1000 * 60 * 60)
            return sum + hours
          }, 0)
          avgDeliveryTime = totalHours / deliveredWithTimes.length
        }

        // Monthly Growth
        const monthlyGrowth = months.map(month => {
          const start = startOfMonth(month)
          const end = endOfMonth(month)
          const monthOrders = orders.filter(o => {
            const oDate = o.createdAt ? new Date(o.createdAt) : null
            return oDate && oDate >= start && oDate <= end
          })
          const revenue = monthOrders.reduce((sum, o) => sum + (o.total || o.totalAmount || 0), 0)
          return {
            month: format(month, 'MMM'),
            orders: monthOrders.length,
            revenue
          }
        })

        if (isMounted) {
          setData({
            revenueTrend: last30Days,
            monthlyRevenue: last6Months,
            userGrowth,
            topProducts,
            topVendors,
            orderStatusDistribution,
            deliveryMetrics: {
              totalDelivered: deliveredOrders.length,
              totalPending: pendingOrders.length,
              totalFailed: failedOrders.length,
              avgDeliveryTime: Math.round(avgDeliveryTime)
            },
            platformMetrics: {
              totalUsers: users.length,
              totalVendors: vendors.length,
              totalBuyers: buyers.length,
              totalDeliveryPartners: deliveryPartners.length,
              totalProducts: products.length,
              totalOrders,
              totalRevenue,
              avgOrderValue
            },
            monthlyGrowth
          })
        }
      } catch (err) {
        console.error('Analytics error:', err)
        if (isMounted) setError(err.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchAnalytics()
    return () => { isMounted = false }
  }, [])

  return { data, loading, error }
}

// ------------------------------
// Metric Card Component (formats value to 2 decimals for currency)
// ------------------------------
function MetricCard({ title, value, icon: Icon, trend, color, prefix = '', suffix = '' }) {
  // If prefix is '₵', format with 2 decimals
  const formattedValue = prefix === '₵' ? formatGHS(value).replace('₵', '') : value
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{prefix}{formattedValue}{suffix}</p>
          {trend && (
            <p className={cn("text-xs mt-2 flex items-center gap-1", trend > 0 ? 'text-green-600' : 'text-red-600')}>
              {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend)}% from last month
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-full bg-gradient-to-br", color)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  )
}

// ------------------------------
// Main Component
// ------------------------------
export default function AnalyticsPage() {
  const { data, loading, error } = useAnalyticsData()

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleExportPDF = () => {
    const originalTitle = document.title
    document.title = 'Analytics Report - Marketplace Admin'

    const style = document.createElement('style')
    style.id = 'print-style'
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #print-area, #print-area * {
          visibility: visible;
        }
        #print-area {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          padding: 20px;
        }
        .no-print, .btn-secondary, .btn-primary, button {
          display: none !important;
        }
        .card {
          break-inside: avoid;
          page-break-inside: avoid;
          border: 1px solid #ddd;
          margin-bottom: 20px;
        }
        .grid {
          display: block;
        }
        .grid > div {
          margin-bottom: 20px;
        }
      }
    `
    document.head.appendChild(style)

    window.print()

    document.head.removeChild(style)
    document.title = originalTitle
    toast.success('Print report generated')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-12 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Error Loading Analytics</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="btn-primary">Retry</button>
      </div>
    )
  }

  const {
    revenueTrend,
    monthlyRevenue,
    userGrowth,
    topProducts,
    topVendors,
    orderStatusDistribution,
    deliveryMetrics,
    platformMetrics,
    monthlyGrowth
  } = data

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Platform performance, growth metrics, and insights
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-2">
            <FileText className="w-4 h-4" /> Export PDF
          </button>
          <button onClick={handleRefresh} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Printable area */}
      <div id="print-area">
        {/* Platform Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard title="Total Revenue" value={platformMetrics.totalRevenue} icon={DollarSign} color="from-green-500 to-green-600" prefix="₵" />
          <MetricCard title="Total Orders" value={platformMetrics.totalOrders} icon={ShoppingCart} color="from-blue-500 to-blue-600" />
          <MetricCard title="Avg Order Value" value={platformMetrics.avgOrderValue} icon={Activity} color="from-purple-500 to-purple-600" prefix="₵" suffix="" />
          <MetricCard title="Total Users" value={platformMetrics.totalUsers} icon={Users} color="from-orange-500 to-orange-600" />
          <MetricCard title="Vendors" value={platformMetrics.totalVendors} icon={Store} color="from-teal-500 to-teal-600" />
          <MetricCard title="Buyers" value={platformMetrics.totalBuyers} icon={Users} color="from-cyan-500 to-cyan-600" />
          <MetricCard title="Products" value={platformMetrics.totalProducts} icon={Package} color="from-pink-500 to-pink-600" />
          <MetricCard title="Delivery Partners" value={platformMetrics.totalDeliveryPartners} icon={Truck} color="from-indigo-500 to-indigo-600" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue Trend (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => `₵${v.toFixed(2)}`} />
                <Tooltip formatter={(v) => `₵${v.toFixed(2)}`} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Monthly Revenue & Orders</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" tickFormatter={(v) => `₵${v.toFixed(2)}`} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(v, name) => name === 'revenue' ? `₵${v.toFixed(2)}` : v} />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name="Revenue (₵)" />
                <Bar yAxisId="right" dataKey="orders" fill="#10b981" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">User Growth (Last 6 Months)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="newUsers" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Monthly Growth (Orders & Revenue)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" tickFormatter={(v) => `₵${v.toFixed(2)}`} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(v, name) => name === 'revenue' ? `₵${v.toFixed(2)}` : v} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#3b82f6" name="Revenue (₵)" />
                <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#10b981" name="Orders" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products & Vendors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Top 5 Products by Revenue</h3>
            <div className="space-y-3">
              {topProducts.map((product, idx) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-primary-600 w-6">#{idx + 1}</span>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.quantity} units sold</p>
                    </div>
                  </div>
                  <p className="font-semibold text-green-600">{formatGHS(product.revenue)}</p>
                </div>
              ))}
              {topProducts.length === 0 && <p className="text-center text-gray-500">No data</p>}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Top 5 Vendors by Revenue</h3>
            <div className="space-y-3">
              {topVendors.map((vendor, idx) => (
                <div key={vendor.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-primary-600 w-6">#{idx + 1}</span>
                    <div>
                      <p className="font-medium">{vendor.name}</p>
                      <p className="text-xs text-gray-500">{vendor.orders} orders</p>
                    </div>
                  </div>
                  <p className="font-semibold text-green-600">{formatGHS(vendor.revenue)}</p>
                </div>
              ))}
              {topVendors.length === 0 && <p className="text-center text-gray-500">No data</p>}
            </div>
          </div>
        </div>

        {/* Delivery & Order Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Truck className="w-5 h-5" /> Delivery Performance</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{deliveryMetrics.totalDelivered}</p>
                <p className="text-xs text-gray-500">Delivered</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{deliveryMetrics.totalPending}</p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{deliveryMetrics.totalFailed}</p>
                <p className="text-xs text-gray-500">Failed/Cancelled</p>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-2xl font-bold">{deliveryMetrics.avgDeliveryTime > 0 ? `${deliveryMetrics.avgDeliveryTime}h` : 'N/A'}</p>
                <p className="text-xs text-gray-500">Avg Delivery Time</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Order Status Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={orderStatusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {orderStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}