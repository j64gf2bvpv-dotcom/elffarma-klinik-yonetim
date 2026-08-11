import { UserCircle2, Phone, MessageCircle, Mail, MapPin, Link2 } from 'lucide-react'
import type { Staff } from '@/types/database'

type CardStaff = Pick<
  Staff,
  'full_name' | 'job_title' | 'avatar_url' | 'phone' | 'whatsapp_phone' | 'email' | 'address' | 'social_media'
>

/**
 * Salt görsel kartvizit — Ayarlar > Profilim'de canlı önizleme olarak
 * kullanılır. `object-fit: cover` sabit boyutlu daire içinde her çözünürlük/
 * en-boy oranındaki fotoğrafı bozmadan (kırparak) gösterir — ayrı bir kırpma
 * arayüzü gerekmiyor.
 */
export function StaffBusinessCard({ staff }: { staff: CardStaff }) {
  const whatsapp = staff.whatsapp_phone?.trim() || staff.phone?.trim()
  const socialLinks = (staff.social_media ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <div className="from-card to-muted/40 w-full max-w-xs rounded-2xl border bg-gradient-to-br p-5 shadow-sm">
      <div className="flex items-center gap-3">
        {staff.avatar_url ? (
          <img
            src={staff.avatar_url}
            alt=""
            className="ring-primary/20 size-16 shrink-0 rounded-full object-cover ring-2"
          />
        ) : (
          <span className="bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-full">
            <UserCircle2 className="size-8" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{staff.full_name || 'İsim Soyisim'}</p>
          {staff.job_title && <p className="text-muted-foreground truncate text-sm">{staff.job_title}</p>}
        </div>
      </div>
      {(staff.phone || whatsapp || staff.email || staff.address || socialLinks.length > 0) && (
        <div className="mt-4 grid gap-1.5 text-sm">
          {staff.phone && (
            <div className="flex items-center gap-2">
              <Phone className="text-muted-foreground size-3.5 shrink-0" /> <span>{staff.phone}</span>
            </div>
          )}
          {whatsapp && (
            <div className="flex items-center gap-2">
              <MessageCircle className="text-muted-foreground size-3.5 shrink-0" /> <span>{whatsapp}</span>
            </div>
          )}
          {staff.email && (
            <div className="flex items-center gap-2">
              <Mail className="text-muted-foreground size-3.5 shrink-0" /> <span className="truncate">{staff.email}</span>
            </div>
          )}
          {staff.address && (
            <div className="flex items-start gap-2">
              <MapPin className="text-muted-foreground mt-0.5 size-3.5 shrink-0" /> <span>{staff.address}</span>
            </div>
          )}
          {socialLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <Link2 className="text-muted-foreground size-3.5 shrink-0" /> <span className="truncate">{link}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
