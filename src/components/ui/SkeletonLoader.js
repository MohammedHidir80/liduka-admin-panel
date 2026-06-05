'use client'

import { cn } from '@/utils/cn'

export function SkeletonLoader({ className }) {
  return (
    <div className={cn("animate-pulse bg-gray-200 dark:bg-gray-700 rounded", className)} />
  )
}