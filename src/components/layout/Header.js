'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useAuthStore from '@/store/authStore'
import useAdminStore from '@/store/adminStore'
import { logout } from '@/lib/auth'
import ThemeToggle from './ThemeToggle'
import { LogOut, User, Bell, Menu } from 'lucide-react'
import { Menu as HeadlessMenu, Transition } from '@headlessui/react'
import { cn } from '@/utils/cn'
import { motion } from 'framer-motion'

export default function Header() {
  const { user, adminData } = useAuthStore()
  const { toggleSidebar } = useAdminStore()
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  return (
    <header className="fixed top-0 right-0 left-0 md:left-auto bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-20">
      <div className="flex items-center justify-between px-4 h-16">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <ThemeToggle />
          
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          <HeadlessMenu as="div" className="relative">
            <HeadlessMenu.Button className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold">
                {adminData?.fullName?.[0] || 'A'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium">{adminData?.fullName || 'Admin'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{adminData?.role}</p>
              </div>
            </HeadlessMenu.Button>

            <Transition
              enter="transition duration-100 ease-out"
              enterFrom="transform scale-95 opacity-0"
              enterTo="transform scale-100 opacity-100"
              leave="transition duration-75 ease-out"
              leaveFrom="transform scale-100 opacity-100"
              leaveTo="transform scale-95 opacity-0"
            >
              <HeadlessMenu.Items className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
                <HeadlessMenu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleLogout}
                      className={cn(
                        "flex items-center w-full px-4 py-2 text-sm",
                        active ? "bg-gray-100 dark:bg-gray-700" : ""
                      )}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </button>
                  )}
                </HeadlessMenu.Item>
              </HeadlessMenu.Items>
            </Transition>
          </HeadlessMenu>
        </div>
      </div>
    </header>
  )
}