'use client'

import { useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import MobileNav from '@/components/layout/MobileNav'
import useAdminStore from '@/store/adminStore'
import useAuthStore from '@/store/authStore'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

export default function AdminLayout({ children }) {
  const { sidebarOpen } = useAdminStore()
  const { user, adminData } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!user || !adminData) {
      router.push('/auth/login')
    }
  }, [user, adminData, router])

  if (!user || !adminData) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <Header />
      <MobileNav />

      <main
        className={`
          transition-all duration-300 ease-in-out
          pt-16 px-4 md:px-6 pb-8
          ${sidebarOpen ? 'md:pl-64' : 'md:pl-20'}
        `}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-[1600px] mx-auto"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}