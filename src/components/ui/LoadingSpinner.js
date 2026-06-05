'use client'

import { cn } from '@/utils/cn'

export default function LoadingSpinner({ size = 'medium' }) {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
  }
  
  return (
    <div className="flex justify-center items-center">
      <div
        className={cn(
          "border-4 border-gray-200 dark:border-gray-700 border-t-primary-600 rounded-full animate-spin",
          sizeClasses[size]
        )}
      />
    </div>
  )
}