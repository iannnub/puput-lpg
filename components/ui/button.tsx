import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 min-h-11 px-4 py-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-green-700',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-sky-700',
        danger: 'bg-danger text-danger-foreground hover:bg-red-700',
        destructive: 'bg-danger text-danger-foreground hover:bg-red-700',
        warning: 'bg-warning text-warning-foreground hover:bg-amber-700',
        outline: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100',
        ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
      },
      size: {
        default: 'min-h-11 px-4 py-2',
        sm: 'min-h-11 px-3 text-sm',
        lg: 'min-h-12 px-6 text-base',
        icon: 'min-h-11 min-w-11'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
