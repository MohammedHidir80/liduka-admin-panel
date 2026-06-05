'use client'

import { Sun, Moon } from 'lucide-react'
import useThemeStore from '@/store/themeStore'
import { motion } from 'framer-motion'

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeStore()

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </motion.button>
  )
}