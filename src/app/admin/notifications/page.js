'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
  limit,
  doc,
  setDoc
} from 'firebase/firestore'

import {
  Bell,
  Send,
  AlertCircle,
  Package,
  DollarSign,
  ShieldAlert,
  Megaphone,
  RefreshCw
} from 'lucide-react'

import toast from 'react-hot-toast'
import { db } from '@/lib/firebase'
import { cn } from '@/utils/cn'

const DEMO_USER_ID = 'demo_user_001'

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [adminNotifications, setAdminNotifications] = useState([])
  const [broadcasts, setBroadcasts] = useState([])

  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    target: 'all_users'
  })

  // --------------------------------------
  // CREATE DEMO COLLECTIONS AUTOMATICALLY
  // --------------------------------------
  const initializeDemoData = async () => {
    try {
      // USER NOTIFICATION DEMO
      await addDoc(
        collection(
          db,
          'notifications',
          DEMO_USER_ID,
          'userNotifications'
        ),
        {
          title: 'Order Shipped',
          message: 'Your order is on the way',
          type: 'order_update',
          read: false,
          createdAt: serverTimestamp()
        }
      )

      // ADMIN NOTIFICATION DEMO
      await addDoc(collection(db, 'adminNotifications'), {
        title: 'New Withdrawal Request',
        message: 'Vendor KND Electronics requested ₵500',
        type: 'withdrawal_request',
        priority: 'high',
        read: false,
        createdAt: serverTimestamp()
      })

      // SECOND ADMIN NOTIFICATION
      await addDoc(collection(db, 'adminNotifications'), {
        title: 'New Order Created',
        message: 'Order #8392 was placed successfully',
        type: 'new_order',
        priority: 'normal',
        read: false,
        createdAt: serverTimestamp()
      })

      // BROADCAST NOTIFICATION DEMO
      await addDoc(collection(db, 'broadcastNotifications'), {
        title: 'Free Delivery Weekend',
        message: 'Enjoy free delivery across Ghana this weekend',
        target: 'all_users',
        createdAt: serverTimestamp()
      })

      // CREATE SETTINGS DOCUMENT
      await setDoc(doc(db, 'system', 'notifications'), {
        initialized: true,
        updatedAt: serverTimestamp()
      })

    } catch (err) {
      console.error(err)
    }
  }

  // --------------------------------------
  // FETCH DATA
  // --------------------------------------
  const fetchData = async () => {
    try {
      setLoading(true)

      const adminSnap = await getDocs(
        query(
          collection(db, 'adminNotifications'),
          orderBy('createdAt', 'desc'),
          limit(20)
        )
      )

      const broadcastSnap = await getDocs(
        query(
          collection(db, 'broadcastNotifications'),
          orderBy('createdAt', 'desc'),
          limit(20)
        )
      )

      setAdminNotifications(
        adminSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      )

      setBroadcasts(
        broadcastSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      )

    } catch (err) {
      console.error(err)
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------
  // SEND BROADCAST
  // --------------------------------------
  const sendBroadcast = async (e) => {
    e.preventDefault()

    try {
      if (!broadcastForm.title || !broadcastForm.message) {
        toast.error('Please fill all fields')
        return
      }

      await addDoc(collection(db, 'broadcastNotifications'), {
        title: broadcastForm.title,
        message: broadcastForm.message,
        target: broadcastForm.target,
        createdAt: serverTimestamp()
      })

      toast.success('Broadcast sent')

      setBroadcastForm({
        title: '',
        message: '',
        target: 'all_users'
      })

      fetchData()

    } catch (err) {
      console.error(err)
      toast.error('Failed to send broadcast')
    }
  }

  // --------------------------------------
  // INITIALIZE
  // --------------------------------------
  useEffect(() => {
    const setup = async () => {
      await initializeDemoData()
      await fetchData()
    }

    setup()
  }, [])

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notifications Center</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Monitor marketplace alerts and broadcasts
          </p>
        </div>
        <button
          onClick={fetchData}
          className="btn-secondary flex items-center gap-2 self-start"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="card p-6">
          <Bell className="w-8 h-8 text-blue-500 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Admin Alerts</p>
          <p className="text-3xl font-bold dark:text-white">{adminNotifications.length}</p>
        </div>
        <div className="card p-6">
          <Megaphone className="w-8 h-8 text-purple-500 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Broadcasts</p>
          <p className="text-3xl font-bold dark:text-white">{broadcasts.length}</p>
        </div>
        <div className="card p-6">
          <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Unread Alerts</p>
          <p className="text-3xl font-bold dark:text-white">
            {adminNotifications.filter(n => !n.read).length}
          </p>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ADMIN FEED */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-bold dark:text-white">Admin Activity Feed</h2>
          </div>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : adminNotifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No notifications found</div>
            ) : (
              adminNotifications.map(notification => (
                <div
                  key={notification.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold dark:text-white">{notification.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {notification.message}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {notification.type === 'withdrawal_request' ? (
                        <DollarSign className="w-5 h-5 text-green-500" />
                      ) : (
                        <Package className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SEND BROADCAST */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Send className="w-5 h-5 text-primary-500" />
            <h2 className="text-xl font-bold dark:text-white">Send Broadcast</h2>
          </div>
          <form onSubmit={sendBroadcast} className="space-y-5">
            <div>
              <label className="block mb-2 text-sm font-medium dark:text-gray-300">Title</label>
              <input
                type="text"
                value={broadcastForm.title}
                onChange={(e) =>
                  setBroadcastForm(prev => ({ ...prev, title: e.target.value }))
                }
                className="input"
                placeholder="Free Delivery Weekend"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium dark:text-gray-300">Message</label>
              <textarea
                rows={5}
                value={broadcastForm.message}
                onChange={(e) =>
                  setBroadcastForm(prev => ({ ...prev, message: e.target.value }))
                }
                className="input"
                placeholder="Enjoy free delivery this weekend across Ghana"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium dark:text-gray-300">Audience</label>
              <select
                value={broadcastForm.target}
                onChange={(e) =>
                  setBroadcastForm(prev => ({ ...prev, target: e.target.value }))
                }
                className="input"
              >
                <option value="all_users">All Users</option>
                <option value="buyers">Buyers</option>
                <option value="vendors">Vendors</option>
                <option value="delivery">Delivery Partners</option>
              </select>
            </div>
            <button type="submit" className="btn-primary w-full">Send Broadcast</button>
          </form>
        </div>
      </div>

      {/* BROADCAST HISTORY */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Megaphone className="w-5 h-5 text-purple-500" />
          <h2 className="text-xl font-bold dark:text-white">Broadcast History</h2>
        </div>
        <div className="space-y-4">
          {broadcasts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No broadcasts found</div>
          ) : (
            broadcasts.map(broadcast => (
              <div
                key={broadcast.id}
                className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold dark:text-white">{broadcast.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {broadcast.message}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 whitespace-nowrap">
                    {broadcast.target}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}