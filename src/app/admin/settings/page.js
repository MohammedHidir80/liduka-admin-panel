'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { db, auth } from '@/lib/firebase'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { updateProfile, updateEmail, sendEmailVerification } from 'firebase/auth'
import { Dialog, Transition, Tab } from '@headlessui/react'
import {
  Settings,
  Globe,
  DollarSign,
  User,
  Shield,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'
import useAuthStore from '@/store/authStore'

// ------------------------------
// Custom hook for settings
// ------------------------------
function usePlatformSettings() {
  const [settings, setSettings] = useState({
    // General
    platformName: 'Marketplace',
    supportEmail: 'support@example.com',
    contactPhone: '',
    currency: 'GHS',
    currencySymbol: '₵',
    timezone: 'Africa/Accra',
    maintenanceMode: false,
    maintenanceMessage: 'We are currently under maintenance. Please check back later.',
    // Commission & Fees
    marketplaceCommission: 10, // percentage
    deliveryBaseFee: 10,
    deliveryFeePerKm: 1.5,
    minWithdrawalAmount: 100,
    vendorPayoutDays: 7,
    // Security
    sessionTimeout: 60, // minutes
    twoFactorAuth: false,
    ipWhitelisting: false,
    whitelistedIps: [],
    // Last updated
    updatedAt: null,
    updatedBy: null
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user, adminData } = useAuthStore()

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const settingsRef = doc(db, 'settings', 'platformSettings')
      const settingsSnap = await getDoc(settingsRef)
      if (settingsSnap.exists()) {
        setSettings(prev => ({ ...prev, ...settingsSnap.data() }))
      } else {
        // Create default settings document
        await setDoc(settingsRef, {
          ...settings,
          createdAt: serverTimestamp(),
          createdBy: adminData?.uid || user?.uid
        })
      }
    } catch (err) {
      console.error(err)
      setError(err.message)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [adminData, user])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = async (updatedFields) => {
    try {
      const settingsRef = doc(db, 'settings', 'platformSettings')
      await updateDoc(settingsRef, {
        ...updatedFields,
        updatedAt: serverTimestamp(),
        updatedBy: adminData?.uid || user?.uid
      })
      setSettings(prev => ({ ...prev, ...updatedFields }))
      toast.success('Settings updated successfully')
      return true
    } catch (err) {
      console.error(err)
      toast.error(err.message)
      return false
    }
  }

  return { settings, loading, error, updateSettings, refresh: fetchSettings }
}

// ------------------------------
// Admin Profile Section
// ------------------------------
function AdminProfileSection() {
  const { user, adminData, setAdminData } = useAuthStore()
  const [fullName, setFullName] = useState(adminData?.fullName || '')
  const [email, setEmail] = useState(user?.email || '')
  const [updating, setUpdating] = useState(false)

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setUpdating(true)
    try {
      // Update display name in Firebase Auth
      if (fullName !== adminData?.fullName && user) {
        await updateProfile(user, { displayName: fullName })
      }
      // Update email (requires re-authentication; for simplicity, we'll just show a message)
      if (email !== user?.email) {
        toast.error('Email change requires re-authentication. Please use Firebase Console or contact support.')
      }
      // Update Firestore admin document
      const adminRef = doc(db, 'adminUsers', user.uid)
      await updateDoc(adminRef, { fullName, updatedAt: serverTimestamp() })
      setAdminData({ ...adminData, fullName })
      toast.success('Profile updated')
    } catch (err) {
      console.error(err)
      toast.error(err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleResetPassword = async () => {
    if (!user?.email) return
    try {
      await sendPasswordResetEmail(auth, user.email)
      toast.success('Password reset email sent')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <form onSubmit={handleUpdateProfile} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Full Name</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="input"
          placeholder="Your full name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Email Address</label>
        <input
          type="email"
          value={email}
          disabled
          className="input bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
        />
        <p className="text-xs text-gray-500 mt-1">Contact support to change email address</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Role</label>
        <input
          type="text"
          value={adminData?.role || 'Admin'}
          disabled
          className="input bg-gray-100 dark:bg-gray-700 cursor-not-allowed capitalize"
        />
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={updating} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {updating ? 'Saving...' : 'Save Changes'}
        </button>
        <button type="button" onClick={handleResetPassword} className="btn-secondary flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Reset Password
        </button>
      </div>
    </form>
  )
}

// ------------------------------
// Security Section
// ------------------------------
function SecuritySection({ settings, updateSettings }) {
  const [sessionTimeout, setSessionTimeout] = useState(settings.sessionTimeout)
  const [twoFactorAuth, setTwoFactorAuth] = useState(settings.twoFactorAuth)
  const [ipWhitelisting, setIpWhitelisting] = useState(settings.ipWhitelisting)
  const [whitelistedIps, setWhitelistedIps] = useState(settings.whitelistedIps?.join(', ') || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const updated = await updateSettings({
      sessionTimeout: parseInt(sessionTimeout),
      twoFactorAuth,
      ipWhitelisting,
      whitelistedIps: whitelistedIps.split(',').map(ip => ip.trim()).filter(ip => ip)
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Session Timeout (minutes)</label>
        <input
          type="number"
          value={sessionTimeout}
          onChange={(e) => setSessionTimeout(e.target.value)}
          className="input"
          min="5"
          max="480"
        />
        <p className="text-xs text-gray-500 mt-1">Auto logout after inactivity</p>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium dark:text-gray-300">Two-Factor Authentication</label>
          <p className="text-xs text-gray-500">Require 2FA for all admin logins</p>
        </div>
        <button
          type="button"
          onClick={() => setTwoFactorAuth(!twoFactorAuth)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            twoFactorAuth ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-600"
          )}
        >
          <span className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            twoFactorAuth ? "translate-x-6" : "translate-x-1"
          )} />
        </button>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium dark:text-gray-300">IP Whitelisting</label>
          <button
            type="button"
            onClick={() => setIpWhitelisting(!ipWhitelisting)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              ipWhitelisting ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-600"
            )}
          >
            <span className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              ipWhitelisting ? "translate-x-6" : "translate-x-1"
            )} />
          </button>
        </div>
        {ipWhitelisting && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Whitelisted IP Addresses</label>
            <textarea
              value={whitelistedIps}
              onChange={(e) => setWhitelistedIps(e.target.value)}
              className="input"
              rows="3"
              placeholder="192.168.1.1, 10.0.0.1, 203.0.113.5"
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated list of allowed IP addresses</p>
          </div>
        )}
      </div>
      <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save Security Settings'}
      </button>
    </form>
  )
}

// ------------------------------
// General Settings Section
// ------------------------------
function GeneralSettingsSection({ settings, updateSettings }) {
  const [formData, setFormData] = useState({
    platformName: settings.platformName,
    supportEmail: settings.supportEmail,
    contactPhone: settings.contactPhone || '',
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    timezone: settings.timezone,
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage || ''
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await updateSettings(formData)
    setSaving(false)
  }

  const timezones = [
    'Africa/Accra', 'Africa/Lagos', 'Africa/Nairobi', 'America/New_York',
    'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Dubai',
    'Asia/Singapore', 'Australia/Sydney'
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Platform Name</label>
        <input
          type="text"
          value={formData.platformName}
          onChange={(e) => handleChange('platformName', e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Support Email</label>
        <input
          type="email"
          value={formData.supportEmail}
          onChange={(e) => handleChange('supportEmail', e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Contact Phone (optional)</label>
        <input
          type="tel"
          value={formData.contactPhone}
          onChange={(e) => handleChange('contactPhone', e.target.value)}
          className="input"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">Currency Code</label>
          <input
            type="text"
            value={formData.currency}
            onChange={(e) => handleChange('currency', e.target.value.toUpperCase())}
            className="input"
            placeholder="GHS"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">Currency Symbol</label>
          <input
            type="text"
            value={formData.currencySymbol}
            onChange={(e) => handleChange('currencySymbol', e.target.value)}
            className="input"
            placeholder="₵"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Timezone</label>
        <select
          value={formData.timezone}
          onChange={(e) => handleChange('timezone', e.target.value)}
          className="input"
        >
          {timezones.map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300">Maintenance Mode</label>
            <p className="text-xs text-gray-500">When enabled, only admins can access the platform</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('maintenanceMode', !formData.maintenanceMode)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              formData.maintenanceMode ? "bg-red-600" : "bg-gray-300 dark:bg-gray-600"
            )}
          >
            <span className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              formData.maintenanceMode ? "translate-x-6" : "translate-x-1"
            )} />
          </button>
        </div>
        {formData.maintenanceMode && (
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Maintenance Message</label>
            <textarea
              value={formData.maintenanceMessage}
              onChange={(e) => handleChange('maintenanceMessage', e.target.value)}
              className="input"
              rows="3"
              placeholder="We are currently under maintenance. Please check back later."
            />
          </div>
        )}
      </div>
      <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save General Settings'}
      </button>
    </form>
  )
}

// ------------------------------
// Commission & Fees Section
// ------------------------------
function CommissionFeesSection({ settings, updateSettings }) {
  const [formData, setFormData] = useState({
    marketplaceCommission: settings.marketplaceCommission,
    deliveryBaseFee: settings.deliveryBaseFee,
    deliveryFeePerKm: settings.deliveryFeePerKm,
    minWithdrawalAmount: settings.minWithdrawalAmount,
    vendorPayoutDays: settings.vendorPayoutDays
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await updateSettings(formData)
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Marketplace Commission (%)</label>
        <input
          type="number"
          step="0.5"
          min="0"
          max="100"
          value={formData.marketplaceCommission}
          onChange={(e) => handleChange('marketplaceCommission', e.target.value)}
          className="input"
        />
        <p className="text-xs text-gray-500 mt-1">Percentage deducted from each sale</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Delivery Base Fee (₵)</label>
        <input
          type="number"
          step="0.5"
          min="0"
          value={formData.deliveryBaseFee}
          onChange={(e) => handleChange('deliveryBaseFee', e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Delivery Fee Per Km (₵)</label>
        <input
          type="number"
          step="0.5"
          min="0"
          value={formData.deliveryFeePerKm}
          onChange={(e) => handleChange('deliveryFeePerKm', e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Minimum Withdrawal Amount (₵)</label>
        <input
          type="number"
          step="10"
          min="0"
          value={formData.minWithdrawalAmount}
          onChange={(e) => handleChange('minWithdrawalAmount', e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Vendor Payout Days (after delivery)</label>
        <input
          type="number"
          min="0"
          max="30"
          value={formData.vendorPayoutDays}
          onChange={(e) => handleChange('vendorPayoutDays', e.target.value)}
          className="input"
        />
        <p className="text-xs text-gray-500 mt-1">Number of days after delivery before payout is processed</p>
      </div>
      <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save Commission Settings'}
      </button>
    </form>
  )
}

// ------------------------------
// Main Settings Page
// ------------------------------
export default function SettingsPage() {
  const { settings, loading, error, updateSettings, refresh } = usePlatformSettings()
  const { adminData } = useAuthStore()
  const isSuperAdmin = adminData?.role === 'super_admin'

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-12 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Error Loading Settings</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button onClick={refresh} className="btn-primary">Retry</button>
      </div>
    )
  }

  // Only super admins can edit certain settings, but we'll show all tabs
  const tabs = [
    { name: 'General', icon: Globe, component: GeneralSettingsSection },
    { name: 'Commission & Fees', icon: DollarSign, component: CommissionFeesSection },
    { name: 'Admin Profile', icon: User, component: AdminProfileSection },
    { name: 'Security', icon: Shield, component: SecuritySection }
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure platform settings, commissions, and security preferences
          </p>
        </div>
        <button onClick={refresh} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <Tab.Group>
        <Tab.List className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => (
            <Tab
              key={tab.name}
              className={({ selected }) => cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all",
                selected
                  ? "bg-white dark:bg-gray-800 text-primary-600 border-b-2 border-primary-600"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.name}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels className="mt-6">
          {tabs.map((tab, idx) => (
            <Tab.Panel key={tab.name} className="card p-6">
              <tab.component
                settings={settings}
                updateSettings={updateSettings}
              />
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>

      <div className="text-center text-xs text-gray-500 pt-4">
        Last updated: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : 'Never'}
      </div>
    </div>
  )
}