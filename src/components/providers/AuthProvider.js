'use client'

import { useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import useAuthStore from '@/store/authStore'
import { useRouter, usePathname } from 'next/navigation'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const publicPaths = ['/auth/login', '/auth/forgot-password']

export default function AuthProvider({ children }) {
  const {
    setUser,
    setAdminData,
    setPermissions,
    setIsLoading,
    isLoading,
  } = useAuthStore()

  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setIsLoading(true)

        if (user) {
          // CHECK USERS COLLECTION
          const userDoc = await getDoc(doc(db, 'users', user.uid))

          if (userDoc.exists()) {
            const userData = userDoc.data()

            // VERIFY ADMIN ROLE
            if (userData.role === 'admin') {
              setUser(user)
              setAdminData(userData)
              setPermissions(userData.permissions || {})

              // Redirect logged in admin
              if (publicPaths.includes(pathname)) {
                router.push('/admin/dashboard')
              }
            } else {
              // Not admin
              await signOut(auth)

              setUser(null)
              setAdminData(null)
              setPermissions({})

              router.push('/auth/login')
            }
          } else {
            // User document missing
            await signOut(auth)

            setUser(null)
            setAdminData(null)
            setPermissions({})

            router.push('/auth/login')
          }
        } else {
          // No auth user
          setUser(null)
          setAdminData(null)
          setPermissions({})

          if (
            !publicPaths.includes(pathname) &&
            pathname?.startsWith('/admin')
          ) {
            router.push('/auth/login')
          }
        }
      } catch (error) {
        console.error('Auth error:', error)

        setUser(null)
        setAdminData(null)
        setPermissions({})

        router.push('/auth/login')
      } finally {
        setIsLoading(false)
      }
    })

    return () => unsubscribe()
  }, [
    pathname,
    router,
    setAdminData,
    setIsLoading,
    setPermissions,
    setUser,
  ])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return children
}