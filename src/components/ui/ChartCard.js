'use client'

import { cn } from '@/utils/cn'

export default function ChartCard({ title, children, className }) {
  return (
    <div className={cn("card p-6", className)}>
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  )
}