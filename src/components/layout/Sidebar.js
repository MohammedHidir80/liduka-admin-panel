'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useAdminStore from '@/store/adminStore'
import useAuthStore from '@/store/authStore'
import { cn } from '@/utils/cn'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  ShoppingCart,
  Truck,
  DollarSign,
  AlertTriangle,
  Bell,
  Grid,
  BarChart3,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  Activity,
  AlertCircle, // 👈 Add icon for live counter
} from 'lucide-react'

export const navItems = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, permissions: [] },
  // 👇 NEW: Live Counter (visible to all authenticated admins)
  { name: 'Live Counter', href: '/admin/live-counter', icon: Activity, permissions: [] },
  { name: 'Users', href: '/admin/users', icon: Users, permissions: ['canManageUsers'] },
  { name: 'Vendors', href: '/admin/vendors', icon: Store, permissions: ['canManageUsers'] },
  { name: 'Reports', href: '/admin/reports', icon: AlertCircle, permissions: ['canManageUsers'] },

  { name: 'Products', href: '/admin/products', icon: Package, permissions: ['canManageProducts'] },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingCart, permissions: ['canManageOrders'] },
  { name: 'Delivery', href: '/admin/delivery', icon: Truck, permissions: ['canManageDelivery'] },
  { name: 'Finance', href: '/admin/finance', icon: DollarSign, permissions: ['canManageFinance'] },
  { name: 'Disputes', href: '/admin/disputes', icon: AlertTriangle, permissions: ['canManageDisputes'] },
  { name: 'Notifications', href: '/admin/notifications', icon: Bell, permissions: [] },
  { name: 'Categories', href: '/admin/categories', icon: Grid, permissions: [] },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3, permissions: ['canManageAnalytics'] },
  { name: 'Settings', href: '/admin/settings', icon: Settings, permissions: ['canManageSettings'] },
  { name: 'Admins', href: '/admin/admins', icon: Shield, permissions: [], superAdminOnly: true },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar } = useAdminStore()
  const { permissions, adminData } = useAuthStore()

  const hasPermission = (requiredPermissions) => {
    if (requiredPermissions.length === 0) return true
    return requiredPermissions.some(p => permissions[p] === true)
  }

  const filteredNavItems = navItems.filter(item => {
    if (item.superAdminOnly && adminData?.role !== 'super_admin') return false
    return hasPermission(item.permissions)
  })

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 80 }}
        className="hidden md:block fixed left-0 top-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-30"
      >
        <div className="flex flex-col h-full">
          {/* Logo Area */}
          <div className="flex items-center justify-center py-6 border-b border-gray-200 dark:border-gray-700">
            {sidebarOpen ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="text-2xl font-extrabold"
              >
                <span className="text-black dark:text-white">lidu</span>
                <span className="text-[#1877f2]">ka</span>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1877f2] to-[#0e5bc0] flex items-center justify-center text-white font-bold text-sm"
              >
                L
              </motion.div>
            )}
          </div>

          {/* Toggle & Title Section */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            {sidebarOpen && (
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium text-gray-500 dark:text-gray-400"
              >
                Admin Panel
              </motion.h1>
            )}
            <button
              onClick={toggleSidebar}
              className={cn(
                "p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                !sidebarOpen && "mx-auto"
              )}
            >
              {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>

          <nav className="flex-1 py-4 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center px-4 py-3 mx-2 mb-1 rounded-lg transition-all duration-200 group",
                    isActive
                      ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", sidebarOpen ? "mr-3" : "mx-auto")} />
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="whitespace-nowrap"
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              )
            })}
          </nav>
        </div>
      </motion.aside>
    </>
  )
}