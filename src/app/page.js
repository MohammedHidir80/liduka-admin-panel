'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {

  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/dashboard')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">

        <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin" />

        <p className="text-gray-500">
          Redirecting...
        </p>

      </div>
    </div>
  )
}