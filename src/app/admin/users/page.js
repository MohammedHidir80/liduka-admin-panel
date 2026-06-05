'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from '@/lib/firebase'
import { 
  collection, getDocs, query, where, orderBy, limit, startAfter, 
  updateDoc, doc, deleteDoc 
} from 'firebase/firestore'
import { Search, Filter, Ban, Trash2, Eye, ChevronLeft, ChevronRight, MapPin, Phone, Calendar, Globe, CreditCard, User, Mail, Map, Navigation, Activity, Image } from 'lucide-react'
import { motion } from 'framer-motion'
import { Dialog, Transition } from '@headlessui/react'
import toast from 'react-hot-toast'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '@/utils/cn'

const USERS_PER_PAGE = 10

// Custom hook with refresh capability
function useUsers(selectedRole, currentPage, refreshKey = 0) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalUsers, setTotalUsers] = useState(0)
  const [lastDoc, setLastDoc] = useState(null)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function fetchUsers() {
      if (!isMounted) return
      setLoading(true)

      try {
        let constraints = []
        if (selectedRole !== 'all') {
          constraints.push(where('role', '==', selectedRole))
        }
        constraints.push(orderBy('createdAt', 'desc'))
        constraints.push(limit(USERS_PER_PAGE))

        // Only apply startAfter if we have a lastDoc and currentPage > 1
        if (currentPage > 1 && lastDoc) {
          constraints.push(startAfter(lastDoc))
        }

        const q = query(collection(db, 'users'), ...constraints)
        const snapshot = await getDocs(q)

        const usersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          lastActive: doc.data().lastActive?.toDate?.() || doc.data().lastActive,
          pushTokenUpdatedAt: doc.data().pushTokenUpdatedAt?.toDate?.() || doc.data().pushTokenUpdatedAt,
        }))

        if (isMounted) {
          setUsers(usersData)
          setLastDoc(snapshot.docs[snapshot.docs.length - 1])
          setHasMore(snapshot.docs.length === USERS_PER_PAGE)

          // Get total count (cached or fallback)
          // For better performance, consider using a separate counter collection
          const totalSnapshot = await getDocs(collection(db, 'users'))
          if (isMounted) setTotalUsers(totalSnapshot.size)
        }
      } catch (error) {
        console.error('Error fetching users:', error)
        if (isMounted) toast.error('Failed to load users')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchUsers()

    return () => {
      isMounted = false
    }
  }, [selectedRole, currentPage, refreshKey]) // refreshKey triggers refetch

  return { users, loading, totalUsers, hasMore }
}

// Helper to safely format date
const formatDate = (date) => {
  if (!date) return 'N/A'
  try {
    return format(new Date(date), 'PPP p')
  } catch {
    return 'Invalid date'
  }
}

// Helper to format relative time
const formatRelative = (date) => {
  if (!date) return 'Never'
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return 'Unknown'
  }
}

// User Detail Modal Component
function UserDetailModal({ user, isOpen, onClose }) {
  if (!user) return null

  const locationUrl = user.latitude && user.longitude
    ? `https://www.google.com/maps?q=${user.latitude},${user.longitude}`
    : null

  return (
    <Transition show={isOpen} as={Dialog} onClose={onClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
        <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
            <Dialog.Title className="text-xl font-bold">User Details</Dialog.Title>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Header with avatar and cover */}
            <div className="relative">
              {user.coverURL && (
                <div className="h-32 rounded-lg overflow-hidden bg-gray-100">
                  <img src={user.coverURL} alt="Cover" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-center gap-4 mt-4">
                {user.avatarURL ? (
                  <img src={user.avatarURL} alt={user.fullName} className="w-16 h-16 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                    <User className="w-8 h-8 text-primary-600" />
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold">{user.fullName || 'Unnamed User'}</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="capitalize px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">{user.role}</span>
                    {user.banned && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30">Banned</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Two-column info grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Column 1 */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm">{user.email || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm">{user.phone || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="text-sm">{user.address || 'N/A'}</p>
                    {user.city && <p className="text-xs text-gray-500">{user.city}, {user.country}</p>}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Region</p>
                    <p className="text-sm capitalize">{user.regionLabel || user.region || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Column 2 */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <CreditCard className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Currency</p>
                    <p className="text-sm">{user.currency} ({user.symbol})</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Joined</p>
                    <p className="text-sm">{formatDate(user.createdAt)}</p>
                    <p className="text-xs text-gray-500">{formatRelative(user.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Activity className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Last Active</p>
                    <p className="text-sm">{formatDate(user.lastActive)}</p>
                    <p className="text-xs text-gray-500">{formatRelative(user.lastActive)}</p>
                  </div>
                </div>
                {locationUrl && (
                  <div className="flex items-start gap-2">
                    <Map className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Location</p>
                      <a href={locationUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline">
                        {user.latitude?.toFixed(4)}, {user.longitude?.toFixed(4)}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Push Token (if exists) */}
            {user.pushToken && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-start gap-2">
                  <Navigation className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Push Token</p>
                    <p className="text-xs font-mono break-all">{user.pushToken}</p>
                    <p className="text-xs text-gray-500">Updated: {formatDate(user.pushTokenUpdatedAt)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Avatar & Cover URLs for debugging (collapsible) */}
            {(user.avatarURL || user.coverURL) && (
              <details className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <summary className="text-xs text-gray-500 cursor-pointer">Media URLs</summary>
                <div className="mt-2 space-y-2 text-xs">
                  {user.avatarURL && <p className="break-all"><strong>Avatar:</strong> {user.avatarURL}</p>}
                  {user.coverURL && <p className="break-all"><strong>Cover:</strong> {user.coverURL}</p>}
                </div>
              </details>
            )}
          </div>

          <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 px-6 py-4 rounded-b-xl flex justify-end">
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Transition>
  )
}

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isBanModalOpen, setIsBanModalOpen] = useState(false)

  const { users, loading, totalUsers, hasMore } = useUsers(selectedRole, currentPage, refreshKey)

  // Local search filter
  const filteredUsers = users.filter(user =>
    user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE)

  // Refresh data after mutations
  const refreshData = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  async function handleBanUser(user) {
    try {
      await updateDoc(doc(db, 'users', user.id), {
        banned: !user.banned,
        updatedAt: new Date(),
      })
      toast.success(`User ${user.banned ? 'unbanned' : 'banned'} successfully`)
      refreshData()
    } catch (error) {
      toast.error('Failed to update user')
    }
    setIsBanModalOpen(false)
  }

  async function handleDeleteUser(userId) {
    if (confirm('Are you sure? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'users', userId))
        toast.success('User deleted successfully')
        refreshData()
        // If current page becomes empty, go to previous page
        if (filteredUsers.length === 1 && currentPage > 1) {
          setCurrentPage(prev => prev - 1)
        }
      } catch (error) {
        toast.error('Failed to delete user')
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage all users across your marketplace
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Total: {totalUsers} users
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
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
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value)
              setCurrentPage(1)
              refreshData()
            }}
            className="input pl-10 appearance-none cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="vendor">Vendor</option>
            <option value="buyer">Buyer</option>
            <option value="deliveryPartner">Delivery Partner</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatarURL ? (
                          <img src={user.avatarURL} alt={user.fullName} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{user.fullName || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{user.phone}</span>
                        </div>
                      )}
                      {user.city && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          <MapPin className="w-3 h-3" />
                          <span>{user.city}, {user.country}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {user.createdAt ? format(new Date(user.createdAt), 'MMM dd, yyyy') : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 text-xs rounded-full",
                        user.banned ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      )}>
                        {user.banned ? 'Banned' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user)
                            setIsViewModalOpen(true)
                          }}
                          className="p-1 text-blue-600 hover:text-blue-700 transition-colors"
                          title="View details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(user)
                            setIsBanModalOpen(true)
                          }}
                          className="p-1 text-yellow-600 hover:text-yellow-700 transition-colors"
                          title={user.banned ? "Unban user" : "Ban user"}
                        >
                          <Ban className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-1 text-red-600 hover:text-red-700 transition-colors"
                          title="Delete user"
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
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || !hasMore}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      <UserDetailModal
        user={selectedUser}
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
      />

      {/* Ban Confirmation Modal */}
      <Transition show={isBanModalOpen} as={Dialog} onClose={() => setIsBanModalOpen(false)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <Dialog.Title className="text-xl font-bold mb-4">
              {selectedUser?.banned ? 'Unban User' : 'Ban User'}
            </Dialog.Title>
            <p className="mb-6">
              Are you sure you want to {selectedUser?.banned ? 'unban' : 'ban'} <strong>{selectedUser?.fullName}</strong>?
              {!selectedUser?.banned && ' This will prevent them from accessing the platform.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleBanUser(selectedUser)} className="btn-primary flex-1">
                Confirm
              </button>
              <button onClick={() => setIsBanModalOpen(false)} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Transition>
    </div>
  )
}