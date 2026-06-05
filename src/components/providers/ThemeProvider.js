'use client'

import { useEffect } from 'react'
import useThemeStore from '@/store/themeStore'

export default function ThemeProvider({ children }) {
  const { theme, setTheme } = useThemeStore()

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-storage')
    if (savedTheme) {
      const parsed = JSON.parse(savedTheme)
      setTheme(parsed.state.theme)
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(prefersDark ? 'dark' : 'light')
    }
  }, [setTheme])

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return children
}