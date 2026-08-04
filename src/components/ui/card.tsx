import * as React from 'react'

import { cn } from '@/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'bg-card/90 supports-[backdrop-filter]:backdrop-blur-xl text-card-foreground flex min-w-0 flex-col gap-4 rounded-xl border border-border/60 shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_1px_2px_rgba(0,0,0,0.04),0_20px_44px_-24px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.02] transition-all duration-300 hover:shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_1px_2px_rgba(0,0,0,0.04),0_28px_56px_-24px_rgba(0,0,0,0.28)]',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col gap-1 px-6 pt-6', className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('leading-none font-semibold', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-content" className={cn('min-w-0 px-6 pb-6', className)} {...props} />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center px-6 pb-6', className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
