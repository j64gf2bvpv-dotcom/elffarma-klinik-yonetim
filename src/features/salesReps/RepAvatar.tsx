import { useQuery } from '@tanstack/react-query'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { placeholderColor } from '@/lib/placeholderColor'
import { usePersonnel } from '@/features/personnel/hooks'
import { personOfName } from '@/features/personnel/vehicleLink'
import { getDocumentUrl } from '@/lib/documentAttachments'

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Satış temsilcisi resmi: aynı addaki personelin kartındaki fotoğraf önce gelir (kullanıcı isteği, 2026-11-19);
 * personelin fotoğrafı yoksa temsilcinin kendi resmi, o da yoksa baş harfler.
 */
export function RepAvatar({ name, photoUrl, className, fallbackClassName }: { name: string; photoUrl?: string | null; className?: string; fallbackClassName?: string }) {
  const { data: people = [] } = usePersonnel()
  const path = personOfName(name, people)?.photo_path ?? null
  const personnelUrl = useQuery({
    queryKey: ['doc-url', path],
    queryFn: () => getDocumentUrl(path!),
    enabled: !!path,
    staleTime: 1000 * 60 * 8,
  }).data
  const src = personnelUrl ?? (path ? null : photoUrl)
  return (
    <Avatar className={cn('size-9 shrink-0', className)}>
      {src && <AvatarImage src={src} alt={name} className="object-cover" />}
      <AvatarFallback className={cn('text-xs font-semibold text-white', fallbackClassName)} style={{ backgroundColor: placeholderColor(name) }}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
