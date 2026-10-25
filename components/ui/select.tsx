import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex min-h-11 w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 text-base text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60',
          className
        )}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'

export { Select }
