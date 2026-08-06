import * as React from 'react'

/**
 * Küçük liste/kart görselleri için: `src` boşsa VEYA yüklenemezse (silinmiş/
 * geçersiz Storage linki) tarayıcının kırık resim simgesi yerine `fallback`
 * gösterilir.
 */
export function SafeThumbnail({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string | null
  alt: string
  className?: string
  fallback: React.ReactNode
}) {
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => setFailed(false), [src])

  if (!src || failed) return <>{fallback}</>
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
}
