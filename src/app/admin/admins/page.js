'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { db, auth, secondaryAuth } from '@/lib/firebase'
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from 'firebase/firestore'
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    deleteUser
} from 'firebase/auth'
import { Dialog, Transition } from '@headlessui/react'
import {
    Shield,
    Plus,
    Edit,
    Trash2,
    XCircle,
    Mail,
    User,
    Key,
    CheckCircle,
    AlertCircle,
    Eye,
    EyeOff,
    RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'

// ------------------------------
// Constants
// ------------------------------
const USER_ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    MODERATOR: 'moderator',
    SUPPORT_AGENT: 'support_agent',
    FINANCE_ADMIN: 'finance_admin',
    LOGISTICS_ADMIN: 'logistics_admin'
}

const PERMISSIONS = {
    canManageUsers: 'canManageUsers',
    canManageOrders: 'canManageOrders',
    canManageProducts: 'canManageProducts',
    canManageFinance: 'canManageFinance',
    canManageDelivery: 'canManageDelivery',
    canManageDisputes: 'canManageDisputes',
    canManageWithdrawals: 'canManageWithdrawals',
    canManageAnalytics: 'canManageAnalytics',
    canManageSettings: 'canManageSettings'
}

// Default permissions per role
const DEFAULT_PERMISSIONS = {
    [USER_ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS).reduce((acc, p) => ({ ...acc, [p]: true }), {}),
    [USER_ROLES.ADMIN]: {
        canManageUsers: true,
        canManageOrders: true,
        canManageProducts: true,
        canManageFinance: false,
        canManageDelivery: true,
        canManageDisputes: true,
        canManageWithdrawals: false,
        canManageAnalytics: true,
        canManageSettings: false
    },
    [USER_ROLES.MODERATOR]: {
        canManageUsers: true,
        canManageOrders: false,
        canManageProducts: true,
        canManageFinance: false,
        canManageDelivery: false,
        canManageDisputes: true,
        canManageWithdrawals: false,
        canManageAnalytics: false,
        canManageSettings: false
    },
    [USER_ROLES.SUPPORT_AGENT]: {
        canManageUsers: true,
        canManageOrders: true,
        canManageProducts: false,
        canManageFinance: false,
        canManageDelivery: false,
        canManageDisputes: true,
        canManageWithdrawals: false,
        canManageAnalytics: false,
        canManageSettings: false
    },
    [USER_ROLES.FINANCE_ADMIN]: {
        canManageUsers: false,
        canManageOrders: false,
        canManageProducts: false,
        canManageFinance: true,
        canManageDelivery: false,
        canManageDisputes: false,
        canManageWithdrawals: true,
        canManageAnalytics: true,
        canManageSettings: false
    },
    [USER_ROLES.LOGISTICS_ADMIN]: {
        canManageUsers: false,
        canManageOrders: true,
        canManageProducts: false,
        canManageFinance: false,
        canManageDelivery: true,
        canManageDisputes: false,
        canManageWithdrawals: false,
        canManageAnalytics: true,
        canManageSettings: false
    }
}

// Helper to format role label
const getRoleLabel = (role) => {
    const labels = {
        super_admin: 'Super Admin',
        admin: 'Admin',
        moderator: 'Moderator',
        support_agent: 'Support Agent',
        finance_admin: 'Finance Admin',
        logistics_admin: 'Logistics Admin'
    }
    return labels[role] || role
}

// ------------------------------
// Custom hook to fetch admins
// ------------------------------
function useAdmins(refreshKey) {
    const [admins, setAdmins] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let isMounted = true

        async function fetchAdmins() {
            setLoading(true)
            setError(null)

            try {
                const adminRoles = [
                    USER_ROLES.SUPER_ADMIN,
                    USER_ROLES.ADMIN,
                    USER_ROLES.MODERATOR,
                    USER_ROLES.SUPPORT_AGENT,
                    USER_ROLES.FINANCE_ADMIN,
                    USER_ROLES.LOGISTICS_ADMIN
                ]

                const snapshot = await getDocs(collection(db, 'users'))

                const adminList = snapshot.docs
                    .map(docSnap => ({
                        id: docSnap.id,
                        ...docSnap.data()
                    }))
                    .filter(user =>
                        adminRoles.includes(user.role)
                    )

                if (isMounted) {
                    setAdmins(adminList)
                }

            } catch (err) {
                console.error(err)
                if (isMounted) {
                    setError(err.message)
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        fetchAdmins()

        return () => {
            isMounted = false
        }
    }, [refreshKey])

    return { admins, loading, error }
}

// ------------------------------
// Permission Checkbox Component
// ------------------------------
function PermissionCheckbox({ permission, label, checked, onChange }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(permission, e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        </label>
    )
}

// ------------------------------
// Admin Form Modal (Create/Edit)
// ------------------------------
function AdminFormModal({ isOpen, onClose, admin, onSuccess }) {
    const [formData, setFormData] = useState({
        email: '',
        fullName: '',
        role: USER_ROLES.ADMIN,
        password: '',
        confirmPassword: ''
    })
    const [permissions, setPermissions] = useState({})
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    useEffect(() => {
        if (admin) {
            setFormData({
                email: admin.email || '',
                fullName: admin.fullName || '',
                role: admin.role || USER_ROLES.ADMIN,
                password: '',
                confirmPassword: ''
            })
            setPermissions(admin.permissions || DEFAULT_PERMISSIONS[admin.role] || {})
        } else {
            setFormData({
                email: '',
                fullName: '',
                role: USER_ROLES.ADMIN,
                password: '',
                confirmPassword: ''
            })
            setPermissions(DEFAULT_PERMISSIONS[USER_ROLES.ADMIN])
        }
    }, [admin])

    // Update permissions when role changes
    const handleRoleChange = (role) => {
        setFormData(prev => ({ ...prev, role }))
        setPermissions(DEFAULT_PERMISSIONS[role] || {})
    }

    const handlePermissionChange = (permissionKey, value) => {
        setPermissions(prev => ({ ...prev, [permissionKey]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!admin && formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match')
            return
        }
        if (!admin && formData.password.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }
        setLoading(true)
        try {
            if (admin) {
                // Update existing admin
                const adminRef = doc(db, 'users', admin.id)
                await updateDoc(adminRef, {
                    fullName: formData.fullName,
                    role: formData.role,
                    permissions: permissions,
                    updatedAt: serverTimestamp()
                })
                toast.success('Admin updated successfully')
            } else {
                // Create new admin user in Firebase Auth
                const userCredential = await createUserWithEmailAndPassword(
                    secondaryAuth,
                    formData.email,
                    formData.password
                )
                const newUser = userCredential.user
                // Send email verification (optional)
                await sendEmailVerification(newUser)
                // Store admin data in Firestore
                // Shared user data
                const adminData = {
                    uid: newUser.uid,
                    email: formData.email,
                    fullName: formData.fullName,
                    role: formData.role,
                    permissions: permissions,
                    country: 'Ghana',
                    currency: 'GHS',
                    symbol: '₵',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                }

                // Save to adminUsers collection
                // ALSO save to main users collection
                await setDoc(doc(db, 'users', newUser.uid), adminData)
                await secondaryAuth.signOut()
                toast.success('Admin created successfully')
            }
            onSuccess()
            onClose()
        } catch (err) {
            console.error(err)
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    const isSuperAdmin = admin?.role === USER_ROLES.SUPER_ADMIN
    const isEditingSuperAdmin = admin?.role === USER_ROLES.SUPER_ADMIN

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
                    <div className="flex min-h-full items-center justify-center p-4 py-8">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-2xl transform rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all max-h-[90vh] overflow-y-auto">
                                <div className="flex justify-between items-center mb-4">
                                    <Dialog.Title className="text-xl font-bold dark:text-white">
                                        {admin ? 'Edit Admin' : 'Create New Admin'}
                                    </Dialog.Title>
                                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                                        <XCircle className="w-6 h-6" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.fullName}
                                            onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                                            className="input"
                                            placeholder="John Doe"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            disabled={!!admin}
                                            value={formData.email}
                                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                            className="input disabled:opacity-50"
                                            placeholder="admin@example.com"
                                        />
                                    </div>

                                    {!admin && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                                                    Password
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        required
                                                        value={formData.password}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                                        className="input pr-10"
                                                        placeholder="••••••••"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2"
                                                    >
                                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                                                    Confirm Password
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type={showConfirmPassword ? 'text' : 'password'}
                                                        required
                                                        value={formData.confirmPassword}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                                        className="input pr-10"
                                                        placeholder="••••••••"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2"
                                                    >
                                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                                            Role
                                        </label>
                                        <select
                                            value={formData.role}
                                            onChange={(e) => handleRoleChange(e.target.value)}
                                            className="input"
                                            disabled={isEditingSuperAdmin}
                                        >
                                            {Object.entries(USER_ROLES).map(([key, value]) => (
                                                <option key={value} value={value}>
                                                    {getRoleLabel(value)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Permissions Section (only for non-super-admin) */}
                                    {formData.role !== USER_ROLES.SUPER_ADMIN && (
                                        <div className="border-t pt-4 mt-2">
                                            <label className="block text-sm font-medium mb-3 dark:text-gray-300">
                                                Permissions
                                            </label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                <PermissionCheckbox
                                                    permission={PERMISSIONS.canManageUsers}
                                                    label="Manage Users"
                                                    checked={permissions[PERMISSIONS.canManageUsers] || false}
                                                    onChange={handlePermissionChange}
                                                />
                                                <PermissionCheckbox
                                                    permission={PERMISSIONS.canManageOrders}
                                                    label="Manage Orders"
                                                    checked={permissions[PERMISSIONS.canManageOrders] || false}
                                                    onChange={handlePermissionChange}
                                                />
                                                <PermissionCheckbox
                                                    permission={PERMISSIONS.canManageProducts}
                                                    label="Manage Products"
                                                    checked={permissions[PERMISSIONS.canManageProducts] || false}
                                                    onChange={handlePermissionChange}
                                                />
                                                <PermissionCheckbox
                                                    permission={PERMISSIONS.canManageFinance}
                                                    label="Manage Finance"
                                                    checked={permissions[PERMISSIONS.canManageFinance] || false}
                                                    onChange={handlePermissionChange}
                                                />
                                                <PermissionCheckbox
                                                    permission={PERMISSIONS.canManageDelivery}
                                                    label="Manage Delivery"
                                                    checked={permissions[PERMISSIONS.canManageDelivery] || false}
                                                    onChange={handlePermissionChange}
                                                />
                                                <PermissionCheckbox
                                                    permission={PERMISSIONS.canManageDisputes}
                                                    label="Manage Disputes"
                                                    checked={permissions[PERMISSIONS.canManageDisputes] || false}
                                                    onChange={handlePermissionChange}
                                                />
                                                <PermissionCheckbox
                                                    permission={PERMISSIONS.canManageWithdrawals}
                                                    label="Manage Withdrawals"
                                                    checked={permissions[PERMISSIONS.canManageWithdrawals] || false}
                                                    onChange={handlePermissionChange}
                                                />
                                                <PermissionCheckbox
                                                    permission={PERMISSIONS.canManageAnalytics}
                                                    label="View Analytics"
                                                    checked={permissions[PERMISSIONS.canManageAnalytics] || false}
                                                    onChange={handlePermissionChange}
                                                />
                                                <PermissionCheckbox
                                                    permission={PERMISSIONS.canManageSettings}
                                                    label="Manage Settings"
                                                    checked={permissions[PERMISSIONS.canManageSettings] || false}
                                                    onChange={handlePermissionChange}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3 pt-4">
                                        <button type="button" onClick={onClose} className="btn-secondary">
                                            Cancel
                                        </button>
                                        <button type="submit" disabled={loading} className="btn-primary">
                                            {loading ? 'Saving...' : (admin ? 'Update' : 'Create')}
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
// Delete Confirmation Modal
// ------------------------------
function DeleteConfirmModal({ isOpen, onClose, admin, onConfirm }) {
    const [deleting, setDeleting] = useState(false)

    const handleDelete = async () => {
        setDeleting(true)
        await onConfirm()
        setDeleting(false)
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
                                    Delete Admin
                                </Dialog.Title>
                                <p className="text-gray-600 dark:text-gray-300 mb-6">
                                    Are you sure you want to delete <strong>{admin?.fullName}</strong> ({admin?.email})?
                                    This action cannot be undone.
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button onClick={onClose} className="btn-secondary">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all disabled:opacity-50"
                                    >
                                        {deleting ? 'Deleting...' : 'Delete'}
                                    </button>
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
// Main Admins Page
// ------------------------------
export default function AdminsPage() {
    const [refreshKey, setRefreshKey] = useState(0)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingAdmin, setEditingAdmin] = useState(null)
    const [deletingAdmin, setDeletingAdmin] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')

    const { admins, loading, error, refreshAdmins } = useAdmins(refreshKey)

    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1)
    }

    const handleEdit = (admin) => {
        setEditingAdmin(admin)
        setIsFormOpen(true)
    }

    const handleCreate = () => {
        setEditingAdmin(null)
        setIsFormOpen(true)
    }

    const handleDelete = async () => {
        if (!deletingAdmin) return
        try {
            // Delete from Firestore first

            await updateDoc(doc(db, 'users', deletingAdmin.id), {
                role: 'buyer',
                permissions: {},
                updatedAt: serverTimestamp()
            })
            // Note: Deleting the Firebase Auth user is not possible from client side without admin SDK.
            // You can either leave the auth user orphaned or implement a Cloud Function.
            // We'll just remove the Firestore document and show a warning.
            toast.success('Admin removed from system. (Auth user may still exist)')
            handleRefresh()
        } catch (err) {
            console.error(err)
            toast.error(err.message)
        } finally {
            setDeletingAdmin(null)
        }
    }

    const filteredAdmins = admins.filter(admin => {
        const matchesSearch =
            admin.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            admin.email?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesRole = roleFilter === 'all' || admin.role === roleFilter
        return matchesSearch && matchesRole
    })

    if (error) {
        return (
            <div className="card p-12 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Error Loading Admins</h2>
                <p className="text-gray-600 mb-4">{error}</p>
                <button onClick={handleRefresh} className="btn-primary">Retry</button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Admin Management</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Manage system administrators and their permissions
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleRefresh} className="btn-secondary flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                    <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Add Admin
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input pl-9"
                    />
                </div>
                <div className="relative w-48">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="input pl-9 appearance-none cursor-pointer"
                    >
                        <option value="all">All Roles</option>
                        {Object.values(USER_ROLES).map(role => (
                            <option key={role} value={role}>{getRoleLabel(role)}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Admins Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Admin
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Permissions
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan="5" className="px-6 py-10 text-center">Loading admins...</td></tr>
                            ) : filteredAdmins.length === 0 ? (
                                <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-500">No admins found</td></tr>
                            ) : (
                                filteredAdmins.map((admin) => (
                                    <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                                    <Shield className="w-4 h-4 text-primary-600" />
                                                </div>
                                                <span className="font-medium dark:text-white">{admin.fullName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{admin.email}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700">
                                                {getRoleLabel(admin.role)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {admin.role === USER_ROLES.SUPER_ADMIN ? (
                                                <span className="text-xs text-gray-500">All permissions</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    {Object.entries(admin.permissions || {})
                                                        .filter(([_, val]) => val === true)
                                                        .slice(0, 3)
                                                        .map(([perm]) => (
                                                            <span key={perm} className="px-1.5 py-0.5 text-xs rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                                {perm.replace('canManage', '')}
                                                            </span>
                                                        ))}
                                                    {Object.values(admin.permissions || {}).filter(v => v === true).length > 3 && (
                                                        <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                                                            +{Object.values(admin.permissions).filter(v => v === true).length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEdit(admin)}
                                                    className="p-1 text-blue-600 hover:text-blue-700"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-5 h-5" />
                                                </button>
                                                {admin.role !== USER_ROLES.SUPER_ADMIN && (
                                                    <button
                                                        onClick={() => setDeletingAdmin(admin)}
                                                        className="p-1 text-red-600 hover:text-red-700"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
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

            {/* Create/Edit Modal */}
            <AdminFormModal
                isOpen={isFormOpen}
                onClose={() => {
                    setIsFormOpen(false)
                    setEditingAdmin(null)
                }}
                admin={editingAdmin}
                onSuccess={handleRefresh}
            />

            {/* Delete Confirmation Modal */}
            <DeleteConfirmModal
                isOpen={!!deletingAdmin}
                onClose={() => setDeletingAdmin(null)}
                admin={deletingAdmin}
                onConfirm={handleDelete}
            />
        </div>
    )
}