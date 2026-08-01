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

/**
 * Gerçek logonun tam üstüne, aynı harflerle çakışan görünmez bir kopya —
 * arka planı harf şekillerine kırpılmış (bg-clip-text) dar, parlak bir
 * yıldız ışıltısı; kutunun üzerinden değil harflerin İÇİNDEN, yavaşça
 * belirip kaybolarak geçiyor (sürekli değil, arada bir).
 */
function LogoShine({ textSize }: { textSize: string }) {
  return (
    <span
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 flex items-baseline leading-none font-sans tracking-tight', textSize)}
    >
      <span className="animate-logo-shine-sweep bg-[length:260%_100%] bg-gradient-to-r from-transparent from-42% via-white via-50% to-transparent to-58% bg-clip-text text-transparent">
        <span className="font-light lowercase">elf</span>
        <span className="ml-1 font-bold">FARMA</span>
      </span>
    </span>
  )
}

export function ElffarmaLogo({ size = 'sm', tagline = false, className, variant = 'mono' }: ElffarmaLogoProps) {
  const textSize = size === 'lg' ? 'text-5xl' : 'text-2xl'

  if (variant === 'premium') {
    return (
      <div className={cn('relative flex flex-col items-center', className)}>
        <div className={cn('flex items-baseline leading-none font-sans tracking-tight text-white', textSize)}>
          <span className="font-light lowercase">elf</span>
          <span className="ml-1 font-bold">FARMA</span>
        </div>
        <p className="mt-1 font-serif text-sm italic text-white/80">&quot;Estetik Sanatı&quot;</p>
        <LogoShine textSize={textSize} />
      </div>
    )
  }

  const elfColor = variant === 'onRed' ? 'text-white' : 'text-foreground'
  const farmaColor = variant === 'onRed' ? 'text-white' : 'text-primary'

  return (
    <div className={cn('relative flex flex-col', size === 'lg' ? 'items-center' : 'items-start', className)}>
      <div className={cn('flex items-baseline leading-none font-sans tracking-tight', textSize)}>
        <span className={cn('font-light lowercase', elfColor)}>elf</span>
        <span className={cn('ml-1 font-bold', farmaColor)}>FARMA</span>
      </div>
      {tagline && (
        <p
          className={cn(
            'mt-1 font-serif text-base italic',
            variant === 'onRed' ? 'text-white/85' : 'text-muted-foreground',
          )}
        >
          &quot;Estetik Sanatı&quot;
        </p>
      )}
      <LogoShine textSize={textSize} />
    </div>
  )
}
