import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-b from-primary to-primary/85 text-primary-foreground shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_2px_6px_-1px_rgba(0,0,0,0.3)] hover:shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_4px_10px_-2px_rgba(0,0,0,0.35)] hover:-translate-y-px hover:from-primary hover:to-primary/75',
        destructive:
          'bg-gradient-to-b from-destructive to-destructive/85 text-destructive-foreground shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_2px_6px_-1px_rgba(0,0,0,0.3)] hover:shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_4px_10px_-2px_rgba(0,0,0,0.35)] hover:-translate-y-px',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground hover:-translate-y-px hover:shadow-md',
        secondary:
          'bg-gradient-to-b from-secondary to-secondary/70 text-secondary-foreground shadow-sm hover:shadow-md hover:-translate-y-px',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-10 rounded-lg px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
