import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-worksync-400 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-worksync-600 text-white hover:bg-worksync-500',
        secondary: 'border-transparent bg-surface-elevated text-text-secondary hover:bg-surface-hover',
        destructive: 'border-transparent bg-status-error text-white',
        outline: 'text-text-primary border-surface-border',
        success: 'border-transparent bg-status-success/20 text-status-success',
        warning: 'border-transparent bg-status-warning/20 text-status-warning',
        info: 'border-transparent bg-status-info/20 text-status-info',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge: React.FC<BadgeProps> = ({ className, variant, ...props }) => {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
