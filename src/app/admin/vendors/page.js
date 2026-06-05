'use client'

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/firebase'
import {
    collection, getDocs, query, where, orderBy, limit, startAfter,
    updateDoc, doc, deleteDoc, addDoc, serverTimestamp, getDoc
} from 'firebase/firestore'
import {
    Search, Filter, Ban, Trash2, Eye, ChevronLeft, ChevronRight,
    CheckCircle, Link as LinkIcon, Copy, RefreshCw,
    Store, Package, DollarSign, ShoppingCart, Award,
    TrendingUp, Calendar, Phone, Mail, MapPin, CreditCard
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Dialog, Transition, Tab } from '@headlessui/react'
import toast from 'react-hot-toast'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '@/utils/cn'

const VENDORS_PER_PAGE = 10

// Helper functions
const formatDate = (date) => {
    if (!date) return 'N/A'
    try {
        return format(new Date(date), 'PPP p')
    } catch {
        return 'Invalid date'
    }
}

const formatRelative = (date) => {
    if (!date) return 'Never'
    try {
        return formatDistanceToNow(new Date(date), { addSuffix: true })
    } catch {
        return 'Unknown'
    }
}

// Custom hook for vendors with pagination
function useVendors(status, currentPage, refreshKey) {
    const [vendors, setVendors] = useState([])
    const [loading, setLoading] = useState(true)
    const [totalVendors, setTotalVendors] = useState(0)
    const [lastDoc, setLastDoc] = useState(null)
    const [hasMore, setHasMore] = useState(true)

    useEffect(() => {
        let isMounted = true

        async function fetchVendors() {
            if (!isMounted) return
            setLoading(true)

            try {
                let constraints = [where('role', '==', 'vendor')]
                if (status !== 'all') {
                    if (status === 'approved') constraints.push(where('approved', '==', true))
                    else if (status === 'pending') constraints.push(where('approved', '==', false))
                    else if (status === 'suspended') constraints.push(where('suspended', '==', true))
                }
                constraints.push(orderBy('createdAt', 'desc'))
                constraints.push(limit(VENDORS_PER_PAGE))

                if (currentPage > 1 && lastDoc) {
                    constraints.push(startAfter(lastDoc))
                }

                const q = query(collection(db, 'users'), ...constraints)
                const snapshot = await getDocs(q)

                const vendorsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
                    lastActive: doc.data().lastActive?.toDate?.() || doc.data().lastActive,
                }))

                if (isMounted) {
                    setVendors(vendorsData)
                    setLastDoc(snapshot.docs[snapshot.docs.length - 1])
                    setHasMore(snapshot.docs.length === VENDORS_PER_PAGE)

                    // Get total count (consider using a counter collection for better performance)
                    const countQuery = query(collection(db, 'users'), where('role', '==', 'vendor'))
                    const countSnapshot = await getDocs(countQuery)
                    if (isMounted) setTotalVendors(countSnapshot.size)
                }
            } catch (error) {
                console.error('Error fetching vendors:', error)
                if (isMounted) toast.error('Failed to load vendors')
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        fetchVendors()
        return () => { isMounted = false }
    }, [status, currentPage, refreshKey])

    return { vendors, loading, totalVendors, hasMore }
}

// Custom hook for invites
function useInvites(refreshKey) {
    const [invites, setInvites] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let isMounted = true

        async function fetchInvites() {
            if (!isMounted) return
            setLoading(true)
            try {
                const q = query(collection(db, 'invites'), orderBy('createdAt', 'desc'))
                const snapshot = await getDocs(q)
                const invitesData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
                }))
                if (isMounted) setInvites(invitesData)
            } catch (error) {
                console.error('Error fetching invites:', error)
                if (isMounted) toast.error('Failed to load invites')
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        fetchInvites()
        return () => { isMounted = false }
    }, [refreshKey])

    return { invites, loading }
}

// Vendor Detail Modal – FIXED hoisting and dependencies
function VendorDetailModal({ vendor, isOpen, onClose }) {
    const [vendorStats, setVendorStats] = useState({ products: 0, orders: 0, revenue: 0, rating: 0 })
    const [loadingStats, setLoadingStats] = useState(true)

    useEffect(() => {
        if (!vendor || !isOpen) return

        let isMounted = true

        // Define async function INSIDE the effect – no hoisting problem
        const fetchVendorStats = async () => {
            if (!isMounted) return
            setLoadingStats(true)
            try {
                // Products count
                const productsQuery = query(collection(db, 'products'), where('vendorId', '==', vendor.id))
                const productsSnap = await getDocs(productsQuery)
                const productsCount = productsSnap.size

                // Orders
                const ordersQuery = query(collection(db, 'orders'), where('vendorId', '==', vendor.id))
                const ordersSnap = await getDocs(ordersQuery)
                const orders = ordersSnap.docs.map(doc => doc.data())
                const totalRevenue = orders.reduce((sum, o) => sum + (o.total || o.totalAmount || 0), 0)

                // Rating from vendor document
                const rating = vendor.rating || 0

                if (isMounted) {
                    setVendorStats({
                        products: productsCount,
                        orders: orders.length,
                        revenue: totalRevenue,
                        rating: rating,
                    })
                }
            } catch (error) {
                console.error('Error fetching vendor stats:', error)
            } finally {
                if (isMounted) setLoadingStats(false)
            }
        }

        fetchVendorStats()

        return () => { isMounted = false }
    }, [vendor, isOpen]) // dependency array includes vendor and isOpen

    if (!vendor) return null

    return (
        <Transition show={isOpen} as={Dialog} onClose={onClose}>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
                <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                        <Dialog.Title className="text-xl font-bold">Vendor Details</Dialog.Title>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Header */}
                        <div className="flex items-center gap-4">
                            {vendor.avatarURL ? (
                                <img src={vendor.avatarURL} alt={vendor.fullName} className="w-16 h-16 rounded-full object-cover" />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                                    <Store className="w-8 h-8 text-primary-600" />
                                </div>
                            )}
                            <div>
                                <h2 className="text-2xl font-bold">{vendor.fullName || 'Unnamed Vendor'}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm text-gray-500">{vendor.email}</span>
                                    {vendor.approved ? (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Approved</span>
                                    ) : (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">Pending</span>
                                    )}
                                    {vendor.suspended && <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Suspended</span>}
                                </div>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                                <Package className="w-5 h-5 mx-auto mb-1 text-primary-600" />
                                <p className="text-2xl font-bold">{loadingStats ? '...' : vendorStats.products}</p>
                                <p className="text-xs text-gray-500">Products</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                                <ShoppingCart className="w-5 h-5 mx-auto mb-1 text-green-600" />
                                <p className="text-2xl font-bold">{loadingStats ? '...' : vendorStats.orders}</p>
                                <p className="text-xs text-gray-500">Orders</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                                <DollarSign className="w-5 h-5 mx-auto mb-1 text-yellow-600" />
                                <p className="text-2xl font-bold">{loadingStats ? '...' : `₵${vendorStats.revenue.toLocaleString()}`}</p>
                                <p className="text-xs text-gray-500">Revenue</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                                <Award className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                                <p className="text-2xl font-bold">{loadingStats ? '...' : vendorStats.rating.toFixed(1)}</p>
                                <p className="text-xs text-gray-500">Rating</p>
                            </div>
                        </div>

                        {/* Contact & Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm">{vendor.phone || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm">{vendor.email}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm">{vendor.address || 'No address'}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm">Currency: {vendor.currency} ({vendor.symbol})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm">Joined: {formatRelative(vendor.createdAt)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm">Last active: {formatRelative(vendor.lastActive)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 px-6 py-4 rounded-b-xl flex justify-end">
                        <button onClick={onClose} className="btn-secondary">Close</button>
                    </div>
                </Dialog.Panel>
            </div>
        </Transition>
    )
}

// Invite Management Component
function InviteManagement({ refreshKey, onRefresh }) {
    const { invites, loading } = useInvites(refreshKey)
    const [generating, setGenerating] = useState(false)
    const [selectedInvite, setSelectedInvite] = useState(null)
    const [isInviteDetailOpen, setIsInviteDetailOpen] = useState(false)

    const generateInviteCode = async () => {
        setGenerating(true)
        try {
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
            let code = 'INV-'
            for (let i = 0; i < 8; i++) {
                code += characters.charAt(Math.floor(Math.random() * characters.length))
            }

            await addDoc(collection(db, 'invites'), {
                code,
                createdAt: serverTimestamp(),
                used: false,
                usedBy: null,
            })
            toast.success(`Invite code generated: ${code}`)
            onRefresh()
        } catch (error) {
            console.error('Error generating invite:', error)
            toast.error('Failed to generate invite code')
        } finally {
            setGenerating(false)
        }
    }

    const deleteInvite = async (inviteId) => {
        if (confirm('Delete this invite code? It cannot be used again.')) {
            try {
                await deleteDoc(doc(db, 'invites', inviteId))
                toast.success('Invite deleted')
                onRefresh()
            } catch (error) {
                toast.error('Failed to delete invite')
            }
        }
    }

    const copyInviteLink = (code) => {
        const link = `${window.location.origin}/auth/register?invite=${code}`
        navigator.clipboard.writeText(link)
        toast.success('Invite link copied to clipboard')
    }

    const getUsedByUser = async (usedBy) => {
        if (!usedBy) return null
        const userDoc = await getDoc(doc(db, 'users', usedBy))
        return userDoc.exists() ? userDoc.data() : null
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">Invite Codes</h3>
                    <p className="text-sm text-gray-500">Generate invite links for vendor onboarding</p>
                </div>
                <button
                    onClick={generateInviteCode}
                    disabled={generating}
                    className="btn-primary flex items-center gap-2"
                >
                    {generating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <LinkIcon className="w-4 h-4" />
                    )}
                    Generate New Code
                </button>
            </div>

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Code</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Created</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Used By</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr><td colSpan="5" className="px-6 py-8 text-center">Loading...</td></tr>
                            ) : invites.length === 0 ? (
                                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No invite codes yet</td></tr>
                            ) : (
                                invites.map((invite) => (
                                    <tr key={invite.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="px-6 py-4 font-mono text-sm">{invite.code}</td>
                                        <td className="px-6 py-4 text-sm">{formatDate(invite.createdAt)}</td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2 py-1 text-xs rounded-full",
                                                invite.used ? "bg-gray-100 text-gray-700" : "bg-green-100 text-green-700"
                                            )}>
                                                {invite.used ? 'Used' : 'Available'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {invite.usedBy ? (
                                                <button
                                                    onClick={async () => {
                                                        const user = await getUsedByUser(invite.usedBy)
                                                        setSelectedInvite({ ...invite, usedByUser: user })
                                                        setIsInviteDetailOpen(true)
                                                    }}
                                                    className="text-primary-600 hover:underline"
                                                >
                                                    {invite.usedBy.slice(0, 8)}...
                                                </button>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => copyInviteLink(invite.code)}
                                                    className="p-1 text-blue-600 hover:text-blue-700"
                                                    title="Copy invite link"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                {!invite.used && (
                                                    <button
                                                        onClick={() => deleteInvite(invite.id)}
                                                        className="p-1 text-red-600 hover:text-red-700"
                                                        title="Delete invite"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Invite Detail Modal */}
            <Transition show={isInviteDetailOpen} as={Dialog} onClose={() => setIsInviteDetailOpen(false)}>
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
                        <Dialog.Title className="text-xl font-bold mb-4">Invite Details</Dialog.Title>
                        {selectedInvite && (
                            <div className="space-y-3">
                                <p><strong>Code:</strong> {selectedInvite.code}</p>
                                <p><strong>Created:</strong> {formatDate(selectedInvite.createdAt)}</p>
                                <p><strong>Used:</strong> {selectedInvite.used ? 'Yes' : 'No'}</p>
                                {selectedInvite.usedBy && (
                                    <>
                                        <p><strong>Used By User ID:</strong> {selectedInvite.usedBy}</p>
                                        <hr />
                                        <p><strong>User Info:</strong></p>
                                        <p>Name: {selectedInvite.usedByUser?.fullName || 'N/A'}</p>
                                        <p>Email: {selectedInvite.usedByUser?.email || 'N/A'}</p>
                                    </>
                                )}
                            </div>
                        )}
                        <button onClick={() => setIsInviteDetailOpen(false)} className="btn-primary w-full mt-6">
                            Close
                        </button>
                    </Dialog.Panel>
                </div>
            </Transition>
        </div>
    )
}

// Main Vendors Page
export default function VendorsPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [currentPage, setCurrentPage] = useState(1)
    const [refreshKey, setRefreshKey] = useState(0)
    const [selectedVendor, setSelectedVendor] = useState(null)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [isActionModalOpen, setIsActionModalOpen] = useState(false)

    const { vendors, loading, totalVendors, hasMore } = useVendors(statusFilter, currentPage, refreshKey)

    const filteredVendors = vendors.filter(v =>
        v.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.phone?.includes(searchTerm)
    )

    const totalPages = Math.ceil(totalVendors / VENDORS_PER_PAGE)

    const refreshData = useCallback(() => setRefreshKey(prev => prev + 1), [])

    const handleApproveVendor = async (vendor) => {
        try {
            await updateDoc(doc(db, 'users', vendor.id), {
                approved: true,
                updatedAt: new Date(),
            })
            toast.success(`${vendor.fullName} approved as vendor`)
            refreshData()
        } catch (error) {
            toast.error('Failed to approve vendor')
        }
    }

    const handleSuspendVendor = async (vendor) => {
        try {
            await updateDoc(doc(db, 'users', vendor.id), {
                suspended: !vendor.suspended,
                updatedAt: new Date(),
            })
            toast.success(vendor.suspended ? `${vendor.fullName} unsuspended` : `${vendor.fullName} suspended`)
            refreshData()
        } catch (error) {
            toast.error('Failed to update vendor status')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Vendor Management</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Manage vendors, approve applications, and generate invite codes
                    </p>
                </div>
                <div className="text-sm text-gray-500">
                    Total: {totalVendors} vendors
                </div>
            </div>

            <Tab.Group>
                <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
                    <Tab className={({ selected }) => cn(
                        "w-full rounded-lg py-2.5 text-sm font-medium leading-5 focus:outline-none",
                        selected
                            ? "bg-white dark:bg-gray-700 shadow text-primary-700"
                            : "text-gray-600 hover:bg-white/[0.12] hover:text-gray-800"
                    )}>
                        Vendors
                    </Tab>
                    <Tab className={({ selected }) => cn(
                        "w-full rounded-lg py-2.5 text-sm font-medium leading-5 focus:outline-none",
                        selected
                            ? "bg-white dark:bg-gray-700 shadow text-primary-700"
                            : "text-gray-600 hover:bg-white/[0.12] hover:text-gray-800"
                    )}>
                        Invite Management
                    </Tab>
                </Tab.List>

                <Tab.Panels className="mt-6">
                    {/* Vendors Panel */}
                    <Tab.Panel>
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Search by name, email or phone..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="input pl-10"
                                />
                            </div>
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value)
                                        setCurrentPage(1)
                                    }}
                                    className="input pl-10 appearance-none cursor-pointer"
                                >
                                    <option value="all">All Vendors</option>
                                    <option value="approved">Approved</option>
                                    <option value="pending">Pending Approval</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                            </div>
                        </div>

                        <div className="card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Vendor</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Contact</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Joined</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {loading ? (
                                            <tr><td colSpan="5" className="px-6 py-8 text-center">Loading...</td></tr>
                                        ) : filteredVendors.length === 0 ? (
                                            <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No vendors found</td></tr>
                                        ) : (
                                            filteredVendors.map((vendor) => (
                                                <motion.tr
                                                    key={vendor.id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            {vendor.avatarURL ? (
                                                                <img src={vendor.avatarURL} className="w-8 h-8 rounded-full object-cover" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                                                    <Store className="w-4 h-4" />
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="font-medium">{vendor.fullName}</p>
                                                                <p className="text-xs text-gray-500">{vendor.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm">{vendor.phone || 'No phone'}</div>
                                                        <div className="text-xs text-gray-500">{vendor.city || 'No city'}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            {vendor.approved ? (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 w-fit">Approved</span>
                                                            ) : (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 w-fit">Pending</span>
                                                            )}
                                                            {vendor.suspended && (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 w-fit">Suspended</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm">
                                                        {formatRelative(vendor.createdAt)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => { setSelectedVendor(vendor); setIsDetailModalOpen(true) }}
                                                                className="p-1 text-blue-600 hover:text-blue-700"
                                                                title="View details"
                                                            >
                                                                <Eye className="w-5 h-5" />
                                                            </button>
                                                            {!vendor.approved && (
                                                                <button
                                                                    onClick={() => handleApproveVendor(vendor)}
                                                                    className="p-1 text-green-600 hover:text-green-700"
                                                                    title="Approve vendor"
                                                                >
                                                                    <CheckCircle className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => { setSelectedVendor(vendor); setIsActionModalOpen(true) }}
                                                                className="p-1 text-yellow-600 hover:text-yellow-700"
                                                                title={vendor.suspended ? "Unsuspend" : "Suspend"}
                                                            >
                                                                <Ban className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm(`Delete vendor ${vendor.fullName}? This will also remove their products and orders.`)) {
                                                                        await deleteDoc(doc(db, 'users', vendor.id))
                                                                        toast.success('Vendor deleted')
                                                                        refreshData()
                                                                    }
                                                                }}
                                                                className="p-1 text-red-600 hover:text-red-700"
                                                                title="Delete vendor"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="px-6 py-4 border-t flex justify-between items-center">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="btn-secondary disabled:opacity-50"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm">Page {currentPage} of {totalPages}</span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages || !hasMore}
                                        className="btn-secondary disabled:opacity-50"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </Tab.Panel>

                    {/* Invite Management Panel */}
                    <Tab.Panel>
                        <InviteManagement refreshKey={refreshKey} onRefresh={refreshData} />
                    </Tab.Panel>
                </Tab.Panels>
            </Tab.Group>

            {/* Modals */}
            <VendorDetailModal vendor={selectedVendor} isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} />

            <Transition show={isActionModalOpen} as={Dialog} onClose={() => setIsActionModalOpen(false)}>
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
                        <Dialog.Title className="text-xl font-bold mb-4">
                            {selectedVendor?.suspended ? 'Unsuspend Vendor' : 'Suspend Vendor'}
                        </Dialog.Title>
                        <p className="mb-6">
                            {selectedVendor?.suspended
                                ? `Unsuspend ${selectedVendor?.fullName || 'this vendor'}? They will regain access.`
                                : `Suspend ${selectedVendor?.fullName || 'this vendor'}? They will not be able to sell or access the platform.`}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    if (!selectedVendor) return
                                    handleSuspendVendor(selectedVendor)
                                    setIsActionModalOpen(false)
                                }}
                                className="btn-primary flex-1"
                            >
                                Confirm
                            </button>
                            <button onClick={() => setIsActionModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                        </div>
                    </Dialog.Panel>
                </div>
            </Transition>
        </div>
    )
}