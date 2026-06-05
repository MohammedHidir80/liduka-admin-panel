'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  limit,
  updateDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore'
import { Dialog, Transition, Tab } from '@headlessui/react'
import {
  Truck,
  Users,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Clock,
  Package,
  DollarSign,
  AlertCircle,
  User,
  Lock,
  PlusCircle
} from 'lucide-react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { db, secondaryAuth } from '@/lib/firebase'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'

// Helpers
const formatDate = (date) => {
  if (!date) return 'N/A'
  try {
    return new Date(date).toLocaleString()
  } catch {
    return 'N/A'
  }
}

const formatGHS = (amount) => `₵${Number(amount || 0).toLocaleString()}`

const getDeliveryStatusColor = (status) => {
  switch (status) {
    case 'delivered': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'assigned': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'picked_up': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'in_transit': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }
}

// ------------------------------
// Custom hook to fetch delivery partners and their assigned orders
// ------------------------------
function useDeliveryData() {
  const [partners, setPartners] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const partnersSnap = await getDocs(collection(db, 'deliveryPartners'))
      const partnersData = partnersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      }))

      const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(500)))
      const ordersData = ordersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      }))

      const partnersWithOrders = partnersData.map(partner => ({
        ...partner,
        assignedOrders: ordersData.filter(order => order.partnerId === partner.id || order.partnerID === partner.id)
      }))

      setPartners(partnersWithOrders)
      setOrders(ordersData)
    } catch (err) {
      console.error(err)
      setError(err.message)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const reassignOrder = async (orderId, newPartnerId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { partnerId: newPartnerId, partnerID: newPartnerId })
      await fetchData()
      toast.success('Order reassigned successfully')
    } catch (err) {
      console.error(err)
      toast.error('Failed to reassign order')
    }
  }

  const updateDeliveryStatus = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { deliveryStatus: newStatus })
      await fetchData()
      toast.success(`Delivery status updated to ${newStatus}`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to update status')
    }
  }

  return { partners, orders, loading, error, refresh: fetchData, reassignOrder, updateDeliveryStatus }
}

// ------------------------------
// Order Reassignment Modal
// ------------------------------
function ReassignModal({ isOpen, onClose, order, partners, onReassign }) {
  const [selectedPartner, setSelectedPartner] = useState('')
  const [processing, setProcessing] = useState(false)

  if (!order) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedPartner) {
      toast.error('Please select a delivery partner')
      return
    }
    setProcessing(true)
    await onReassign(order.id, selectedPartner)
    setProcessing(false)
    onClose()
  }

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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all">
                <Dialog.Title className="text-xl font-bold mb-4 dark:text-white">
                  Reassign Order
                </Dialog.Title>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Order #{order.id.slice(0, 8)}... currently assigned to{' '}
                  <strong>{order.partnerId || 'no partner'}</strong>
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                      Select Delivery Partner
                    </label>
                    <select
                      value={selectedPartner}
                      onChange={(e) => setSelectedPartner(e.target.value)}
                      className="input"
                      required
                    >
                      <option value="">Choose a partner</option>
                      {partners.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.fullName} ({p.region}) - {p.isAvailable ? 'Available' : 'Unavailable'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" disabled={processing} className="btn-primary">
                      {processing ? 'Reassigning...' : 'Reassign'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

// ------------------------------
// Order Status Update Modal
// ------------------------------
function StatusModal({ isOpen, onClose, order, onUpdateStatus }) {
  const [newStatus, setNewStatus] = useState(order?.deliveryStatus || 'assigned')
  const [processing, setProcessing] = useState(false)

  if (!order) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newStatus === order.deliveryStatus) {
      toast.info('Status unchanged')
      onClose()
      return
    }
    setProcessing(true)
    await onUpdateStatus(order.id, newStatus)
    setProcessing(false)
    onClose()
  }

  const statusOptions = ['assigned', 'picked_up', 'in_transit', 'delivered']

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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all">
                <Dialog.Title className="text-xl font-bold mb-4 dark:text-white">
                  Update Delivery Status
                </Dialog.Title>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Order #{order.id.slice(0, 8)}... current status:{' '}
                  <span className="font-medium">{order.deliveryStatus || 'unassigned'}</span>
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                      New Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="input"
                      required
                    >
                      {statusOptions.map(opt => (
                        <option key={opt} value={opt}>{opt.replace('_', ' ').toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" disabled={processing} className="btn-primary">
                      {processing ? 'Updating...' : 'Update'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

// ------------------------------
// Add Partner Form Component
// ------------------------------
function AddPartnerForm({ onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    partnerId: '',
    email: '',
    password: '',
    phone: '',
    regions: [],
    type: 'local',
    price: ''
  })

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { fullName, partnerId, email, password, phone, regions, type, price } = formData

      if (!fullName || !partnerId || !email || !password || !phone || !regions.length) {
        toast.error('Please fill all required fields')
        setLoading(false)
        return
      }

      // Create user in secondary auth
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
      const user = userCredential.user

      // Save delivery partner
      await setDoc(doc(db, 'deliveryPartners', partnerId), {
        uid: user.uid,
        partnerId,
        fullName,
        email,
        phone,
        regions,
        type,
        basePrice: Number(price),
        isAvailable: true,
        currentOrders: 0,
        maxOrders: 3,
        createdAt: serverTimestamp()
      })

      // Save user record
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        partnerId,
        fullName,
        email,
        phone,
        role: 'delivery',
        regions,
        createdAt: serverTimestamp()
      })

      toast.success('Delivery partner created successfully')
      setFormData({
        fullName: '',
        partnerId: '',
        email: '',
        password: '',
        phone: '',
        regions: [],
        type: 'local',
        price: ''
      })
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error(err)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <PlusCircle className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Add New Delivery Partner</h2>
          <p className="text-sm text-gray-500">Create a new delivery rider account</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              className="input pl-10"
              placeholder="KND Delivery"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Partner ID</label>
          <input
            type="text"
            required
            value={formData.partnerId}
            onChange={(e) => handleChange('partnerId', e.target.value)}
            className="input"
            placeholder="knd_movers"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="input pl-10"
              placeholder="partner@email.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              required
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="input pl-10"
              placeholder="0501234567"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Region</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              multiple
              value={formData.regions}
              onChange={(e) => {
                const values = Array.from(
                  e.target.selectedOptions,
                  option => option.value
                );

                handleChange('regions', values);
              }}
              className="input pl-10 min-h-[150px]"
            >
              <option value="greater_accra">Greater Accra</option>
              <option value="ashanti">Ashanti</option>
              <option value="northern">Northern</option>
              <option value="upper_east">Upper East</option>
              <option value="upper_west">Upper West</option>
              <option value="volta">Volta</option>
              <option value="eastern">Eastern</option>
              <option value="western">Western</option>
              <option value="central">Central</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Delivery Type</label>
          <select
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value)}
            className="input"
          >
            <option value="local">Local</option>
            <option value="intercity">Intercity</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Base Price (₵)</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              required
              value={formData.price}
              onChange={(e) => handleChange('price', e.target.value)}
              className="input pl-10"
              placeholder="15"
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating Partner...' : 'Create Delivery Partner'}
        </button>
      </form>
    </div>
  )
}

// ------------------------------
// Main Delivery Page (with Tabs)
// ------------------------------
export default function DeliveryPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [regionFilter, setRegionFilter] = useState('all')
  const [expandedPartner, setExpandedPartner] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const { partners, orders, loading, error, refresh, reassignOrder, updateDeliveryStatus } = useDeliveryData(refreshKey)

  const regions = [...new Set(partners.map(p => p.region).filter(Boolean))]

  const filteredPartners = partners.filter(partner => {
    const matchesSearch = partner.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.phone?.includes(searchTerm)
    const matchesRegion = regionFilter === 'all' || partner.region === regionFilter
    return matchesSearch && matchesRegion
  })

  const handleRefresh = () => {
    refresh()
    setRefreshKey(prev => prev + 1)
  }

  if (error) {
    return (
      <div className="card p-12 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Error Loading Data</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button onClick={handleRefresh} className="btn-primary">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Delivery Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage delivery partners, assign orders, and track deliveries
          </p>
        </div>
        <button onClick={handleRefresh} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          <Tab className={({ selected }) => cn(
            "w-full rounded-lg py-2.5 text-sm font-medium leading-5 focus:outline-none",
            selected
              ? "bg-white dark:bg-gray-700 shadow text-primary-700"
              : "text-gray-600 hover:bg-white/[0.12] hover:text-gray-800"
          )}>
            <Truck className="w-4 h-4 inline mr-2" />
            Delivery Partners
          </Tab>
          <Tab className={({ selected }) => cn(
            "w-full rounded-lg py-2.5 text-sm font-medium leading-5 focus:outline-none",
            selected
              ? "bg-white dark:bg-gray-700 shadow text-primary-700"
              : "text-gray-600 hover:bg-white/[0.12] hover:text-gray-800"
          )}>
            <PlusCircle className="w-4 h-4 inline mr-2" />
            Add Partner
          </Tab>
        </Tab.List>

        <Tab.Panels className="mt-6">
          {/* Delivery Partners Panel */}
          <Tab.Panel className="space-y-6">
            {/* Stats summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="card p-6">
                <Truck className="w-8 h-8 text-primary-500 mb-2" />
                <p className="text-sm text-gray-500">Total Partners</p>
                <p className="text-2xl font-bold">{partners.length}</p>
              </div>
              <div className="card p-6">
                <Users className="w-8 h-8 text-green-500 mb-2" />
                <p className="text-sm text-gray-500">Available Partners</p>
                <p className="text-2xl font-bold text-green-600">{partners.filter(p => p.isAvailable).length}</p>
              </div>
              <div className="card p-6">
                <Package className="w-8 h-8 text-orange-500 mb-2" />
                <p className="text-sm text-gray-500">Assigned Orders</p>
                <p className="text-2xl font-bold">{orders.filter(o => o.partnerId).length}</p>
              </div>
              <div className="card p-6">
                <Clock className="w-8 h-8 text-purple-500 mb-2" />
                <p className="text-sm text-gray-500">Pending Deliveries</p>
                <p className="text-2xl font-bold">{orders.filter(o => o.deliveryStatus && o.deliveryStatus !== 'delivered').length}</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-9"
                />
              </div>
              <div className="relative w-48">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="input pl-9 appearance-none cursor-pointer"
                >
                  <option value="all">All Regions</option>
                  {regions.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Partners List */}
            <div className="space-y-4">
              {loading && partners.length === 0 ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="card p-6 animate-pulse">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                ))
              ) : filteredPartners.length === 0 ? (
                <div className="card p-12 text-center text-gray-500">No delivery partners found</div>
              ) : (
                filteredPartners.map(partner => (
                  <div key={partner.id} className="card overflow-hidden">
                    <div
                      className="p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex justify-between items-center"
                      onClick={() => setExpandedPartner(expandedPartner === partner.id ? null : partner.id)}
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                          <Truck className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{partner.fullName}</h3>
                          <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {partner.region || 'N/A'}</span>
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {partner.phone}</span>
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {partner.email}</span>
                            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Base: {formatGHS(partner.basePrice)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className={cn(
                            "px-2 py-1 text-xs rounded-full",
                            partner.isAvailable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          )}>
                            {partner.isAvailable ? 'Available' : 'Busy'}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            Orders: {partner.currentOrders || 0} / {partner.maxOrders || 3}
                          </p>
                        </div>
                        {expandedPartner === partner.id ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {expandedPartner === partner.id && (
                      <div className="border-t border-gray-200 dark:border-gray-700 p-5 bg-gray-50 dark:bg-gray-800/30">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Package className="w-4 h-4" /> Assigned Orders ({partner.assignedOrders?.length || 0})
                        </h4>
                        {partner.assignedOrders?.length === 0 ? (
                          <p className="text-gray-500 text-sm">No orders assigned to this partner.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-100 dark:bg-gray-700/50">
                                <tr>
                                  <th className="p-2 text-left">Order ID</th>
                                  <th className="p-2 text-left">Product</th>
                                  <th className="p-2 text-left">Buyer</th>
                                  <th className="p-2 text-left">Delivery Fee</th>
                                  <th className="p-2 text-left">Delivery Status</th>
                                  <th className="p-2 text-left">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {partner.assignedOrders.map(order => (
                                  <tr key={order.id} className="hover:bg-gray-100 dark:hover:bg-gray-700/30">
                                    <td className="p-2 font-mono text-xs">{order.id.slice(0, 8)}…</td>
                                    <td className="p-2">{order.productTitle?.slice(0, 30) || '—'}</td>
                                    <td className="p-2">{order.address?.fullName || '—'}</td>
                                    <td className="p-2">{formatGHS(order.deliveryFee)}</td>
                                    <td className="p-2">
                                      <span className={cn("px-2 py-0.5 text-xs rounded-full", getDeliveryStatusColor(order.deliveryStatus))}>
                                        {order.deliveryStatus || 'unassigned'}
                                      </span>
                                    </td>
                                    <td className="p-2 flex gap-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setReassignModalOpen(true); }}
                                        className="text-blue-600 hover:text-blue-700"
                                        title="Reassign"
                                      >
                                        <RefreshCw className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setStatusModalOpen(true); }}
                                        className="text-green-600 hover:text-green-700"
                                        title="Update Status"
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Tab.Panel>

          {/* Add Partner Panel */}
          <Tab.Panel>
            <AddPartnerForm onSuccess={handleRefresh} />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {/* Modals */}
      <ReassignModal
        isOpen={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        order={selectedOrder}
        partners={partners}
        onReassign={reassignOrder}
      />
      <StatusModal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        order={selectedOrder}
        onUpdateStatus={updateDeliveryStatus}
      />
    </div>
  )
}