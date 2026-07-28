import { cn } from '@/lib/utils'

interface ElffarmaLogoProps {
  size?: 'sm' | 'lg'
  tagline?: boolean
  className?: string
  /**
   * mono: marka rengiyle (açık zemin). onRed: kırmızı zemin üzerinde beyaz.
   * premium: sidebar/koyu zemin için gerçek logo — beyaz.
   */
  variant?: 'mono' | 'onRed' | 'premium'
}

export function ElffarmaLogo({ size = 'sm', tagline = false, className, variant = 'mono' }: ElffarmaLogoProps) {
  const textSize = size === 'lg' ? 'text-4xl' : 'text-xl'

  if (variant === 'premium') {
    return (
      <div className={cn('flex flex-col items-center', className)}>
        <div className={cn('flex items-baseline leading-none font-sans tracking-tight text-white', textSize)}>
          <span className="font-light lowercase">elf</span>
          <span className="ml-1 font-bold">FARMA</span>
        </div>
        <p className="mt-1 font-serif text-xs italic text-white/80">&quot;Estetik Sanatı&quot;</p>
      </div>
    )
  }

  const elfColor = variant === 'onRed' ? 'text-white' : 'text-foreground'
  const farmaColor = variant === 'onRed' ? 'text-white' : 'text-primary'

  return (
    <div className={cn('flex flex-col', size === 'lg' ? 'items-center' : 'items-start', className)}>
      <div className={cn('flex items-baseline leading-none font-sans tracking-tight', textSize)}>
        <span className={cn('font-light lowercase', elfColor)}>elf</span>
        <span className={cn('ml-1 font-bold', farmaColor)}>FARMA</span>
      </div>
      {tagline && (
        <p
          className={cn(
            'mt-1 font-serif text-sm italic',
            variant === 'onRed' ? 'text-white/85' : 'text-muted-foreground',
          )}
        >
          &quot;Estetik Sanatı&quot;
        </p>
      )}
    </div>
  )
}
