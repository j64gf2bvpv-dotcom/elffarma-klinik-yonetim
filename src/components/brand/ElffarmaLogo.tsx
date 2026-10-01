import { cn } from '@/lib/utils'
import logoWhite from '@/assets/brand/elffarma-logo-white.png'

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
  const textSize = size === 'lg' ? 'text-5xl' : 'text-2xl'
  const wordmarkShadow = 'drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)]'

  // Koyu/kırmızı zeminlerde (sidebar sol üst, giriş ekranı) artık yazıyla
  // taklit değil GERÇEK logo kullanılıyor (kullanıcı isteği, 2026-10-01) —
  // "Elf_Farma Logo vektör.pdf"ten kırmızı zemini çıkarılıp beyaz/şeffaf
  // PNG'ye dönüştürüldü. Görselde "Estetik Sanatı" sloganı zaten var.
  if (variant === 'premium' || variant === 'onRed') {
    return (
      <div className={cn('flex justify-center', className)}>
        <img
          src={logoWhite}
          alt="elf FARMA — Estetik Sanatı"
          draggable={false}
          className={cn(
            'h-auto select-none',
            size === 'lg' ? 'w-[280px] max-w-full' : 'w-[125px] max-w-full',
          )}
          // Hafif kabartma (kullanıcı isteği, 2026-10-01): kabartma görselin
          // kendisinde (harflerin alt-sağ iç kenarları hafif gölgeli, bkz.
          // elffarma-logo-white.png); burada sadece ince bir kenar gölgesi +
          // yumuşak bir gölge logoyu zeminden hafifçe kaldırıyor.
          // Klasik kabartma: üstte ince açık bir parlama, altta ince koyu bir
          // kenar + yumuşak gölge — ekran pikseli cinsinden olduğu için logo
          // ne kadar küçültülürse küçültülsün görünür kalıyor.
          style={{
            filter:
              'drop-shadow(0 -1px 0 rgba(255,255,255,0.45)) drop-shadow(0 1.5px 0 rgba(0,0,0,0.35)) drop-shadow(0 3px 5px rgba(0,0,0,0.25))',
          }}
        />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', size === 'lg' ? 'items-center' : 'items-start', className)}>
      <div className={cn('flex items-baseline leading-none font-sans tracking-tight', textSize, wordmarkShadow)}>
        <span className="text-foreground font-light lowercase">elf</span>
        <span className="text-primary ml-1 font-bold">FARMA</span>
      </div>
      {tagline && <p className="text-muted-foreground mt-1 font-serif text-base italic">&quot;Estetik Sanatı&quot;</p>}
    </div>
  )
}
