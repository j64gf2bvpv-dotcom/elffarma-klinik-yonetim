import { useQuery } from '@tanstack/react-query'
import { UserRound } from 'lucide-react'
import { getDocumentUrl } from '@/lib/documentAttachments'
import { cn } from '@/lib/utils'

/** Personelin vesikalık fotoğrafı (yoksa simge) */
export function PersonPhoto({ path, className }: { path: string | null; className?: string }) {
  const { data: url } = useQuery({
    queryKey: ['doc-url', path],
    queryFn: () => getDocumentUrl(path!),
    enabled: !!path,
    staleTime: 1000 * 60 * 8,
  })
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40', className)}>
      {url ? <img src={url} alt="" className="size-full object-cover" /> : <UserRound className="size-1/2 text-muted-foreground" />}
    </span>
  )
}
