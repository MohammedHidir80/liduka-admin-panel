'use client'

import { useEffect, useState, Fragment } from 'react'
import {
    collection,
    getDocs,
    query,
    orderBy,
    limit
} from 'firebase/firestore'
import { Dialog, Transition } from '@headlessui/react'
import { db } from '@/lib/firebase'
import {
    Package,
    Search,
    Eye,
    RefreshCw,
    Truck,
    CheckCircle,
    Clock,
    XCircle,
    MapPin,
    CreditCard,
    User,
    Store,
    Bike,
    Wallet
} from 'lucide-react'

const formatGHS = (amount) =>
    `₵${Number(amount || 0).toLocaleString()}`

const formatDate = (date) => {
    if (!date) return 'N/A'
    try {
        return new Date(date).toLocaleString()
    } catch {
        return 'Invalid date'
    }
}

const getStatusColor = (status) => {
    switch (status) {
        case 'pending':
            return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
        case 'accepted':
            return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        case 'shipped':
            return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
        case 'delivered':
            return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        case 'cancelled':
            return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        default:
            return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    }
}

const getPaymentStatusColor = (status) => {
    switch (status) {
        case 'held':
            return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
        case 'released':
            return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        case 'refunded':
            return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        default:
            return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    }
}

export default function OrdersPage() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [selectedOrder, setSelectedOrder] = useState(null)

    const fetchOrders = async () => {
        setLoading(true)
        try {
            const q = query(
                collection(db, 'orders'),
                orderBy('createdAt', 'desc'),
                limit(200)
            )
            const snapshot = await getDocs(q)
            const ordersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
                shipDelayEndsAt: doc.data().shipDelayEndsAt?.toDate?.() || doc.data().shipDelayEndsAt
            }))
            setOrders(ordersData)
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchOrders()
    }, [])

    const filteredOrders = orders.filter(order => {
        const search = searchTerm.toLowerCase()
        const matchesSearch =
            order.id?.toLowerCase().includes(search) ||
            order.productTitle?.toLowerCase().includes(search) ||
            order.vendorSnapshot?.vendorName?.toLowerCase().includes(search) ||
            order.address?.fullName?.toLowerCase().includes(search) ||
            order.address?.phone?.toLowerCase().includes(search)
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter
        return matchesSearch && matchesStatus
    })

    // Stats
    const totalOrders = orders.length
    const pendingOrders = orders.filter(o => o.status === 'pending').length
    const acceptedOrders = orders.filter(o => o.status === 'accepted').length
    const shippedOrders = orders.filter(o => o.status === 'shipped').length
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length
    const totalRevenue = orders.reduce((sum, order) => sum + (order.finalTotal || 0), 0)
    const deliveryRevenue = orders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Orders Management</h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Monitor all marketplace orders, delivery and payment status
                    </p>
                </div>
                <button
                    onClick={fetchOrders}
                    className="btn-secondary flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-4">
                <div className="card p-5">
                    <Package className="w-8 h-8 text-blue-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Orders</p>
                    <p className="text-2xl font-bold dark:text-white">{totalOrders}</p>
                </div>
                <div className="card p-5">
                    <Clock className="w-8 h-8 text-yellow-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
                    <p className="text-2xl font-bold dark:text-white">{pendingOrders}</p>
                </div>
                <div className="card p-5">
                    <CheckCircle className="w-8 h-8 text-blue-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Accepted</p>
                    <p className="text-2xl font-bold dark:text-white">{acceptedOrders}</p>
                </div>
                <div className="card p-5">
                    <Truck className="w-8 h-8 text-purple-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Shipped</p>
                    <p className="text-2xl font-bold dark:text-white">{shippedOrders}</p>
                </div>
                <div className="card p-5">
                    <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Delivered</p>
                    <p className="text-2xl font-bold dark:text-white">{deliveredOrders}</p>
                </div>
                <div className="card p-5">
                    <XCircle className="w-8 h-8 text-red-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Cancelled</p>
                    <p className="text-2xl font-bold dark:text-white">{cancelledOrders}</p>
                </div>
                <div className="card p-5">
                    <Wallet className="w-8 h-8 text-primary-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Revenue</p>
                    <p className="text-2xl font-bold dark:text-white">{formatGHS(totalRevenue)}</p>
                </div>
                <div className="card p-5">
                    <Bike className="w-8 h-8 text-orange-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Delivery Fees</p>
                    <p className="text-2xl font-bold dark:text-white">{formatGHS(deliveryRevenue)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search order ID, customer, product..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input pl-10"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="input"
                >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            {/* Orders Table – no Order ID column */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                    Customer
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                    Product
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                    Vendor
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                    Amount
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                    Payment
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                    Date
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="text-center py-10 text-gray-500 dark:text-gray-400">
                                        Loading orders...
                                    </td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="text-center py-10 text-gray-500 dark:text-gray-400">
                                        No orders found
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => (
                                    <tr
                                        key={order.id}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <p className="font-medium dark:text-white">
                                                {order.address?.fullName || '—'}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {order.address?.phone || '—'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-medium line-clamp-1 dark:text-white">
                                                {order.productTitle || '—'}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {order.variantLabel || '—'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-medium dark:text-white">
                                                {order.vendorSnapshot?.vendorName || '—'}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {order.vendorSnapshot?.vendorPhone || '—'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-semibold text-green-600 dark:text-green-400">
                                                {formatGHS(order.finalTotal)}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Delivery: {formatGHS(order.deliveryFee)}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                                                    order.status
                                                )}`}
                                            >
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getPaymentStatusColor(
                                                    order.paymentStatus
                                                )}`}
                                            >
                                                {order.paymentStatus}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {formatDate(order.createdAt)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => setSelectedOrder(order)}
                                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                                title="View details"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Order Detail Modal - using Headless UI Dialog with proper close */}
            <Transition appear show={selectedOrder !== null} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-50"
                    onClose={() => setSelectedOrder(null)}
                >
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
                                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-0 shadow-xl transition-all">
                                    {selectedOrder && (
                                        <>
                                            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                                                <div>
                                                    <Dialog.Title className="text-2xl font-bold dark:text-white">
                                                        Order Details
                                                    </Dialog.Title>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        {selectedOrder.id}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedOrder(null)}
                                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                                >
                                                    <XCircle className="w-6 h-6" />
                                                </button>
                                            </div>

                                            <div className="p-6 space-y-6">
                                                {/* Top Status Cards */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                                                        <Package className="w-6 h-6 text-primary-500 mb-2" />
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            Order Status
                                                        </p>
                                                        <p className="font-bold capitalize dark:text-white">
                                                            {selectedOrder.status}
                                                        </p>
                                                    </div>
                                                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                                                        <CreditCard className="w-6 h-6 text-green-500 mb-2" />
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            Payment Status
                                                        </p>
                                                        <p className="font-bold capitalize dark:text-white">
                                                            {selectedOrder.paymentStatus}
                                                        </p>
                                                    </div>
                                                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                                                        <Wallet className="w-6 h-6 text-purple-500 mb-2" />
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            Total Paid
                                                        </p>
                                                        <p className="font-bold text-green-600 dark:text-green-400">
                                                            {formatGHS(selectedOrder.finalTotal)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Product Information */}
                                                <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
                                                    <h3 className="font-bold text-lg mb-4 dark:text-white">
                                                        Product Information
                                                    </h3>
                                                    <div className="space-y-3">
                                                        <div>
                                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                Product
                                                            </p>
                                                            <p className="font-medium dark:text-white">
                                                                {selectedOrder.productTitle}
                                                            </p>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Quantity
                                                                </p>
                                                                <p className="font-medium dark:text-white">
                                                                    {selectedOrder.quantity}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Unit Price
                                                                </p>
                                                                <p className="font-medium dark:text-white">
                                                                    {formatGHS(selectedOrder.unitPrice)}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Variant
                                                                </p>
                                                                <p className="font-medium dark:text-white">
                                                                    {selectedOrder.variantLabel}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Size / Color
                                                                </p>
                                                                <p className="font-medium dark:text-white">
                                                                    {selectedOrder.size} • {selectedOrder.color}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Buyer + Address */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
                                                        <div className="flex items-center gap-2 mb-4">
                                                            <User className="w-5 h-5 text-blue-500" />
                                                            <h3 className="font-bold text-lg dark:text-white">
                                                                Buyer
                                                            </h3>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Full Name
                                                                </p>
                                                                <p className="font-medium dark:text-white">
                                                                    {selectedOrder.address?.fullName}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Phone
                                                                </p>
                                                                <p className="font-medium dark:text-white">
                                                                    {selectedOrder.address?.phone}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Buyer ID
                                                                </p>
                                                                <p className="font-medium break-all dark:text-white">
                                                                    {selectedOrder.buyerId}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
                                                        <div className="flex items-center gap-2 mb-4">
                                                            <MapPin className="w-5 h-5 text-red-500" />
                                                            <h3 className="font-bold text-lg dark:text-white">
                                                                Delivery Address
                                                            </h3>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <p className="font-medium dark:text-white">
                                                                {selectedOrder.address?.street}
                                                            </p>
                                                            <p className="dark:text-gray-300">
                                                                {selectedOrder.address?.city}, {selectedOrder.address?.region}
                                                            </p>
                                                            <p className="dark:text-gray-300">
                                                                {selectedOrder.address?.country}
                                                            </p>
                                                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                                    GPS Coordinates
                                                                </p>
                                                                <p className="text-sm break-all dark:text-gray-300">
                                                                    Lat: {selectedOrder.address?.gps?.latitude}
                                                                </p>
                                                                <p className="text-sm break-all dark:text-gray-300">
                                                                    Lng: {selectedOrder.address?.gps?.longitude}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Vendor + Delivery */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
                                                        <div className="flex items-center gap-2 mb-4">
                                                            <Store className="w-5 h-5 text-purple-500" />
                                                            <h3 className="font-bold text-lg dark:text-white">
                                                                Vendor
                                                            </h3>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Vendor Name
                                                                </p>
                                                                <p className="font-medium dark:text-white">
                                                                    {selectedOrder.vendorSnapshot?.vendorName}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Phone
                                                                </p>
                                                                <p className="font-medium dark:text-white">
                                                                    {selectedOrder.vendorSnapshot?.vendorPhone}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Region
                                                                </p>
                                                                <p className="font-medium dark:text-white">
                                                                    {selectedOrder.vendorSnapshot?.vendorRegion}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
                                                        <div className="flex items-center gap-2 mb-4">
                                                            <Truck className="w-5 h-5 text-green-500" />
                                                            <h3 className="font-bold text-lg dark:text-white">
                                                                Delivery
                                                            </h3>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Delivery Partner
                                                                </p>
                                                                <p className="font-medium dark:text-white">
                                                                    {selectedOrder.partnerId}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Delivery Status
                                                                </p>
                                                                <p className="font-medium capitalize dark:text-white">
                                                                    {selectedOrder.deliveryStatus}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Delivery Fee
                                                                </p>
                                                                <p className="font-medium dark:text-white">
                                                                    {formatGHS(selectedOrder.deliveryFee)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Timeline */}
                                                <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
                                                    <h3 className="font-bold text-lg mb-4 dark:text-white">
                                                        Timeline
                                                    </h3>
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500 dark:text-gray-400">
                                                                Created At
                                                            </span>
                                                            <span className="font-medium dark:text-white">
                                                                {formatDate(selectedOrder.createdAt)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500 dark:text-gray-400">
                                                                Accepted At
                                                            </span>
                                                            <span className="font-medium dark:text-white">
                                                                {formatDate(
                                                                    selectedOrder.timestamps?.acceptedAt?.toDate?.() ||
                                                                    selectedOrder.timestamps?.acceptedAt
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500 dark:text-gray-400">
                                                                Shipped At
                                                            </span>
                                                            <span className="font-medium dark:text-white">
                                                                {formatDate(
                                                                    selectedOrder.timestamps?.shippedAt?.toDate?.() ||
                                                                    selectedOrder.timestamps?.shippedAt
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500 dark:text-gray-400">
                                                                Ship Delay Ends
                                                            </span>
                                                            <span className="font-medium dark:text-white">
                                                                {formatDate(selectedOrder.shipDelayEndsAt)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Financial Breakdown */}
                                                <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
                                                    <h3 className="font-bold text-lg mb-4 dark:text-white">
                                                        Financial Breakdown
                                                    </h3>
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500 dark:text-gray-400">
                                                                Product Total
                                                            </span>
                                                            <span className="dark:text-white">
                                                                {formatGHS(selectedOrder.total)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500 dark:text-gray-400">
                                                                Delivery Fee
                                                            </span>
                                                            <span className="dark:text-white">
                                                                {formatGHS(selectedOrder.deliveryFee)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500 dark:text-gray-400">
                                                                Discount
                                                            </span>
                                                            <span className="dark:text-white">
                                                                {formatGHS(selectedOrder.discount)}
                                                            </span>
                                                        </div>
                                                        <div className="border-t pt-3 flex justify-between font-bold text-lg">
                                                            <span className="dark:text-white">Final Total</span>
                                                            <span className="text-green-600 dark:text-green-400">
                                                                {formatGHS(selectedOrder.finalTotal)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    )
}