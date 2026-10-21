import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Camera as Instagram, ExternalLink, Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * @elffarma Instagram yeni paylaşım bildirimi (kullanıcı isteği, 2026-10-21:
 * "@elffarma instagram adresinden paylaşım yapıldığında bildirim de gelsin,
 * popup şeklinde ana ekrana"). AppShell'e bir kez konur. 15 dakikada bir (ve
 * açılıştan kısa süre sonra) son paylaşımlara bakar; daha önce görülmemiş
 * paylaşım varsa görsel + açıklamayla popup ve masaüstü bildirimi gösterir.
 * Instagram oturumsuz veri vermediği için Ayarlar > "Instagram'a bağlan" ile
 * programın içinde bir kez giriş yapılmış olmalı (bağlı değilse sessizce bekler).
 * İlk çalışmada var olan paylaşımlar "görüldü" sayılır — eski paylaşımlar için
 * popup çıkmaz.
 */
export const INSTAGRAM_ACCOUNT = 'elffarma'
const CHECK_MS = 15 * 60 * 1000
const SEEN_KEY = `instagram-last-seen-${INSTAGRAM_ACCOUNT}`

type Post = { id: string; shortcode: string; takenAt: number; isVideo: boolean; caption: string; thumbnail: string }

function readSeen(): number | null {
  try {
    const v = localStorage.getItem(SEEN_KEY)
    return v ? Number(v) : null
  } catch {
    return null
  }
}
function writeSeen(t: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(t))
  } catch {
    /* yok say */
  }
}

export function InstagramPostWatcher() {
  const [posts, setPosts] = React.useState<(Post & { image?: string | null })[]>([])
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const api = window.electronAPI
    if (!api?.instagramRecentPosts) return
    let cancelled = false
    async function check() {
      const result = await api!.instagramRecentPosts!(INSTAGRAM_ACCOUNT)
      if (cancelled || !result.posts || result.posts.length === 0) return
      const newest = Math.max(...result.posts.map((p) => p.takenAt))
      const seen = readSeen()
      if (seen == null) {
        writeSeen(newest)
        return
      }
      const fresh = result.posts.filter((p) => p.takenAt > seen).sort((a, b) => b.takenAt - a.takenAt)
      if (fresh.length === 0) return
      writeSeen(newest)
      // Instagram görselleri CORS'suz — ana süreçten data: URL olarak al
      const withImages = await Promise.all(fresh.map(async (p) => ({ ...p, image: p.thumbnail ? await api!.fetchImageDataUrl?.(p.thumbnail) : null })))
      if (cancelled) return
      setPosts(withImages)
      setOpen(true)
      const first = fresh[0]
      void api!.notify?.(
        fresh.length === 1 ? `@${INSTAGRAM_ACCOUNT} yeni paylaşım yaptı` : `@${INSTAGRAM_ACCOUNT} ${fresh.length} yeni paylaşım yaptı`,
        first.caption.slice(0, 140) || (first.isVideo ? 'Yeni video' : 'Yeni gönderi'),
      )
    }
    const first = setTimeout(() => void check(), 20_000)
    const timer = setInterval(() => void check(), CHECK_MS)
    return () => {
      cancelled = true
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [])

  return (
    <Dialog open={open && posts.length > 0} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="size-5 text-[#E1306C]" /> @{INSTAGRAM_ACCOUNT} yeni paylaşım yaptı
          </DialogTitle>
          <DialogDescription>{posts.length === 1 ? 'Instagram hesabınızda yeni bir gönderi var.' : `Instagram hesabınızda ${posts.length} yeni gönderi var.`}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto">
          {posts.map((p) => (
            <a
              key={p.id}
              href={`https://www.instagram.com/p/${p.shortcode}/`}
              target="_blank"
              rel="noreferrer"
              className="flex gap-3 rounded-lg border p-2 transition-colors hover:bg-accent"
            >
              <div className="relative size-24 shrink-0 overflow-hidden rounded-md bg-muted">
                {p.image && <img src={p.image} alt="" className="size-full object-cover" />}
                {p.isVideo && <Play className="absolute top-1 right-1 size-4 fill-white text-white drop-shadow" />}
              </div>
              <div className="min-w-0 text-sm">
                <p className="text-xs text-muted-foreground">{format(new Date(p.takenAt), 'd MMMM yyyy HH:mm', { locale: trLocale })}</p>
                <p className="line-clamp-4 break-words whitespace-pre-line">{p.caption || (p.isVideo ? 'Yeni video' : 'Yeni gönderi')}</p>
                <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                  <ExternalLink className="size-3" /> Instagram'da aç
                </span>
              </div>
            </a>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Ayarlar'da: Instagram bağlantı durumu + bir kez giriş. */
export function InstagramConnectCard() {
  const [status, setStatus] = React.useState<'unknown' | 'connected' | 'disconnected' | 'unsupported'>('unknown')
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined

  React.useEffect(() => {
    if (!api?.instagramStatus) {
      setStatus('unsupported')
      return
    }
    void api.instagramStatus().then((s) => setStatus(s.loggedIn ? 'connected' : 'disconnected'))
  }, [api])

  async function connect() {
    if (!api?.instagramLogin) return
    const ok = await api.instagramLogin()
    setStatus(ok ? 'connected' : 'disconnected')
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium">
          <Instagram className="size-4 text-[#E1306C]" /> @{INSTAGRAM_ACCOUNT} paylaşım bildirimi
        </p>
        <p className="text-sm text-muted-foreground">
          {status === 'connected'
            ? 'Bağlı — yeni paylaşım olunca ana ekranda bildirim çıkar (15 dakikada bir kontrol edilir).'
            : status === 'unsupported'
              ? 'Sadece masaüstü programında çalışır.'
              : 'Instagram oturum açmadan paylaşımları göstermiyor. Bir kez giriş yapın; şifreniz programda saklanmaz, oturum bu bilgisayarda kalır.'}
        </p>
      </div>
      {status !== 'unsupported' && (
        <Button variant={status === 'connected' ? 'outline' : 'default'} onClick={() => void connect()}>
          <Instagram className="size-4" /> {status === 'connected' ? 'Yeniden bağlan' : "Instagram'a bağlan"}
        </Button>
      )}
    </div>
  )
}
