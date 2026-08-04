import * as React from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import {
  Wifi,
  WifiOff,
  LogOut,
  Sun,
  Moon,
  Search,
  Bell,
  Settings as SettingsIcon,
  AlertTriangle,
  CalendarClock,
  Presentation,
  BellRing,
  ClipboardX,
  ClipboardList,
  Boxes,
  Wallet,
  PackageOpen,
  CloudUpload,
  Pencil,
  Save,
  X,
  GripVertical,
  MessageSquare,
  ChevronDown,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { CLINIC_NAME } from '@/lib/supabaseClient'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useApplyBrandTheme } from '@/features/appSettings/useApplyBrandTheme'
import { useAIStartupCheck } from '@/features/ai/useAIStartupCheck'
import { AIChatWidget } from '@/features/ai/AIChatWidget'
import { useAIChatOpen } from '@/features/ai/useAIChatOpen'
import { useColorMode } from '@/features/appSettings/useColorMode'
import { useAppSetting, useSaveAppSetting } from '@/features/appSettings/hooks'
import { getIconSet, type IconVariant, type NavKey } from '@/features/appSettings/iconSets'
import { useAlertsSummary } from '@/features/alerts/useAlertsSummary'
import { useDismissedAlerts } from '@/features/alerts/useDismissedAlerts'
import { useDeleteReminder } from '@/features/reminders/hooks'
import { useOfflineSync } from '@/features/offline/useOfflineSync'
import { getPaymentDueStatus } from '@/lib/paymentDue'
import { tr } from '@/i18n/tr'
import { ElffarmaLogo } from '@/components/brand/ElffarmaLogo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navItems: { to: string; label: string; key: NavKey; end?: boolean }[] = [
  { to: '/', label: tr.nav.dashboard, key: 'dashboard', end: true },
  { to: '/stok', label: tr.nav.stock, key: 'stock' },
  { to: '/kongreler', label: tr.nav.congresses, key: 'congresses' },
  { to: '/tahsilatlar', label: tr.nav.payments, key: 'payments' },
  { to: '/giderler', label: tr.nav.expenses, key: 'expenses' },
  { to: '/satislar', label: tr.nav.sales, key: 'sales' },
  { to: '/cari-hesap', label: tr.nav.cariHesap, key: 'cariHesap' },
  { to: '/butce-yili', label: tr.nav.budget, key: 'budget' },
  { to: '/musteriler', label: tr.nav.customers, key: 'customers' },
  { to: '/doktor-ziyaretleri', label: tr.nav.doctorVisits, key: 'doctorVisits' },
  { to: '/hatirlatmalar', label: tr.nav.reminders, key: 'reminders' },
  { to: '/ajanda', label: tr.nav.agenda, key: 'agenda' },
  { to: '/prim', label: tr.nav.commissions, key: 'commissions' },
  { to: '/crm', label: tr.nav.crm, key: 'crm' },
  { to: '/ai-analiz', label: tr.nav.aiInsights, key: 'aiInsights' },
  { to: '/instagram-doktor-listesi', label: tr.nav.instagramLeads, key: 'instagramLeads' },
  { to: '/araclar', label: tr.nav.vehicles, key: 'vehicles' },
]

const navItemsByKey = new Map(navItems.map((item) => [item.key, item]))

interface NavLayoutItem {
  key: NavKey
  label: string
}

const defaultNavLayout: NavLayoutItem[] = navItems.map((item) => ({ key: item.key, label: item.label }))

function sanitizeNavLayout(input: NavLayoutItem[]): NavLayoutItem[] {
  const known = input.filter((item) => navItemsByKey.has(item.key))
  const presentKeys = new Set(known.map((item) => item.key))
  const missing = defaultNavLayout.filter((item) => !presentKeys.has(item.key))
  return [...known, ...missing]
}

function iconBoxClasses(variant: IconVariant, isActive: boolean): string {
  if (variant === '3d') {
    return cn(
      'bg-gradient-to-br shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_3px_8px_-1px_rgba(0,0,0,0.5)] ring-1 ring-white/10',
      isActive
        ? 'from-sidebar-accent to-sidebar-accent/60 text-sidebar-accent-foreground'
        : 'from-white/15 to-white/5 text-sidebar-foreground/80 group-hover:from-white/25 group-hover:to-white/10 group-hover:text-sidebar-foreground',
    )
  }
  if (variant === 'bold') {
    return cn(
      isActive
        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_1px_0_rgba(255,255,255,0.3)_inset]'
        : 'bg-white/8 text-sidebar-foreground/80 group-hover:bg-white/15 group-hover:text-sidebar-foreground',
    )
  }
  if (variant === 'duotone') {
    return cn(
      'ring-1',
      isActive
        ? 'bg-gradient-to-br from-primary/35 to-primary/10 text-primary ring-primary/30'
        : 'bg-gradient-to-br from-white/10 to-white/[0.03] text-sidebar-foreground/80 ring-white/5 group-hover:from-primary/20 group-hover:to-primary/5 group-hover:text-primary',
    )
  }
  if (variant === 'thin') {
    return cn(
      'bg-transparent',
      isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground',
    )
  }
  return cn(
    isActive
      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_1px_0_rgba(255,255,255,0.3)_inset]'
      : 'bg-white/5 text-sidebar-foreground/70 group-hover:bg-white/10 group-hover:text-sidebar-foreground',
  )
}

function SidebarNavLink({
  to,
  end,
  icon: Icon,
  label,
  variant = 'outline',
  strokeWidth = 1.9,
}: {
  to: string
  end?: boolean
  icon: React.ElementType
  label: string
  variant?: IconVariant
  strokeWidth?: number
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-sidebar-accent/60 text-sidebar-accent-foreground shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_4px_10px_-2px_rgba(0,0,0,0.4)]'
            : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-all duration-300',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110',
              iconBoxClasses(variant, isActive),
            )}
          >
            <Icon
              className="size-[1.15rem]"
              strokeWidth={strokeWidth}
              fill={variant === 'bold' || variant === 'duotone' ? 'currentColor' : 'none'}
              fillOpacity={variant === 'bold' ? 0.15 : variant === 'duotone' ? 0.3 : undefined}
            />
          </span>
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function NotifIcon({ icon: Icon, tone = 'destructive' }: { icon: React.ElementType; tone?: 'destructive' | 'primary' }) {
  return (
    <span
      className={cn(
        'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md',
        tone === 'primary' ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive',
      )}
    >
      <Icon className="size-3.5" />
    </span>
  )
}

function TopBar({ mode, toggleColorMode }: { mode: 'light' | 'dark'; toggleColorMode: () => void }) {
  const { staff, signOut } = useAuth()
  const isOnline = useOnlineStatus()
  const alerts = useAlertsSummary()
  const { dismissed, dismiss } = useDismissedAlerts()
  const deleteReminderMutation = useDeleteReminder()
  const { pendingCount, syncing, flush } = useOfflineSync()
  const [aiChatOpen, setAiChatOpen] = useAIChatOpen()

  const visibleDueReminders = alerts.dueReminders.filter((r) => !dismissed.has(`reminder:${r.id}`))
  const visibleCriticalStock = alerts.criticalStock.filter((p) => !dismissed.has(`criticalStock:${p.id}`))
  const visibleExpiringProducts = alerts.expiringProducts.filter((p) => !dismissed.has(`expiring:${p.id}`))
  const visibleExpiringLots = alerts.expiringLots.filter((l) => !dismissed.has(`expiringLot:${l.id}`))
  const visiblePaymentDue = alerts.paymentDue.filter((d) => !dismissed.has(`paymentDue:${d.id}`))
  const visibleDoctorsWithBalance = alerts.doctorsWithBalance.filter((d) => !dismissed.has(`balance:${d.id}`))
  const visiblePendingProducts = alerts.pendingProducts.filter((p) => !dismissed.has(`pending:${p.id}`))
  const visibleUpcomingCongresses = alerts.upcomingCongresses.filter((c) => !dismissed.has(`congress:${c.id}`))
  const visibleIncompleteChecklists = alerts.incompleteChecklists.filter((c) => !dismissed.has(`checklist:${c.id}`))
  const visibleCongressStockShortfall = alerts.congressStockShortfall.filter(
    (c) => !dismissed.has(`shortfall:${c.id}`),
  )

  const visibleTotal =
    visibleDueReminders.length +
    visibleCriticalStock.length +
    visibleExpiringProducts.length +
    visibleExpiringLots.length +
    visiblePaymentDue.length +
    visibleDoctorsWithBalance.length +
    visiblePendingProducts.length +
    visibleIncompleteChecklists.length +
    visibleCongressStockShortfall.length

  return (
    <header className="bg-background/70 supports-[backdrop-filter]:backdrop-blur-xl sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-border/60 px-6 md:px-8">
      <div className="relative flex-1 max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          type="search"
          placeholder="Ürün, doktor, fatura, kongre, cari, tahsilat ara..."
          className="border-input bg-muted/40 focus-visible:ring-ring/50 h-9 w-full rounded-lg border pl-9 pr-3 text-sm outline-none transition-colors focus-visible:ring-2"
        />
      </div>

      <div className="flex items-center gap-1.5">
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={() => flush()}
            title={isOnline ? 'Bekleyen kayıtları şimdi gönder' : 'Bağlantı gelince otomatik gönderilecek'}
            className="border-warning/30 bg-warning/10 text-warning-foreground flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-warning/20"
          >
            <CloudUpload className={cn('size-3.5', syncing && 'animate-pulse')} />
            {pendingCount} bekleyen kayıt
          </button>
        )}
        <button
          type="button"
          title={isOnline ? 'Bağlantı var' : 'Bağlantı yok — kayıtlar yerelde bekletiliyor'}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground"
        >
          {isOnline ? <Wifi className="size-4 text-success" /> : <WifiOff className="size-4 text-destructive" />}
        </button>

        <button
          type="button"
          onClick={() => setAiChatOpen((v) => !v)}
          title={aiChatOpen ? 'Yapay zeka sohbetini kapat' : 'Yapay zeka sohbetini aç'}
          className={cn(
            'flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground',
            aiChatOpen ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
          )}
        >
          <MessageSquare className="size-[1.1rem]" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Bell className="size-[1.1rem]" />
              {visibleTotal > 0 && (
                <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground animate-alert-glow-red">
                  {visibleTotal > 9 ? '9+' : visibleTotal}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
            <DropdownMenuLabel className="flex items-center justify-between">
              Bildirimler
              <Link to="/hatirlatmalar" className="text-primary text-xs font-normal hover:underline">
                Tümünü gör
              </Link>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {visibleTotal === 0 && (
              <p className="text-muted-foreground px-2 py-4 text-center text-sm">Yeni bildirim yok</p>
            )}
            {visibleDueReminders.slice(0, 3).map((r) => (
              <DropdownMenuItem key={r.id} asChild onSelect={() => deleteReminderMutation.mutate(r.id)}>
                <Link to="/hatirlatmalar" className="flex items-start gap-2">
                  <NotifIcon icon={BellRing} />
                  <span className="text-xs">
                    <span className="font-medium">{r.title}</span> hatırlatması
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {visibleCriticalStock.slice(0, 3).map((p) => (
              <DropdownMenuItem key={p.id} asChild onSelect={() => dismiss(`criticalStock:${p.id}`)}>
                <Link to="/stok" className="flex items-start gap-2">
                  <NotifIcon icon={AlertTriangle} />
                  <span className="text-xs">
                    <span className="font-medium">{p.name}</span> kritik stok seviyesinde ({p.current_quantity} {p.unit})
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {visibleExpiringProducts.slice(0, 3).map((p) => (
              <DropdownMenuItem key={p.id} asChild onSelect={() => dismiss(`expiring:${p.id}`)}>
                <Link to="/stok" className="flex items-start gap-2">
                  <NotifIcon icon={ClipboardX} />
                  <span className="text-xs">
                    <span className="font-medium">{p.name}</span> son kullanım tarihi{' '}
                    {p.expiry_date && new Date(p.expiry_date) < new Date() ? 'doldu' : 'yaklaşıyor'}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {visibleExpiringLots.slice(0, 3).map((lot) => (
              <DropdownMenuItem key={lot.id} asChild onSelect={() => dismiss(`expiringLot:${lot.id}`)}>
                <Link to="/stok" className="flex items-start gap-2">
                  <NotifIcon icon={ClipboardX} />
                  <span className="text-xs">
                    <span className="font-medium">{lot.products?.name ?? 'Ürün'}</span>
                    {lot.lot_no ? ` (Lot: ${lot.lot_no})` : ''} SKT {lot.band} gün içinde
                    {lot.status === 'expired' ? ' doldu' : ''}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {visiblePaymentDue.slice(0, 3).map((d) => (
              <DropdownMenuItem key={d.id} asChild onSelect={() => dismiss(`paymentDue:${d.id}`)}>
                <Link to={`/musteriler/${d.id}`} className="flex items-start gap-2">
                  <NotifIcon icon={CalendarClock} />
                  <span className="text-xs">
                    <span className="font-medium">{d.full_name}</span> için ödeme vadesi{' '}
                    {getPaymentDueStatus(d.next_payment_due) === 'overdue' ? 'geçti' : 'yaklaşıyor'}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {visibleDoctorsWithBalance.slice(0, 3).map((d) => (
              <DropdownMenuItem key={d.id} asChild onSelect={() => dismiss(`balance:${d.id}`)}>
                <Link to={`/musteriler/${d.id}`} className="flex items-start gap-2">
                  <NotifIcon icon={Wallet} />
                  <span className="text-xs">
                    <span className="font-medium">{d.full_name}</span> için eksik bakiye var
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {visiblePendingProducts.slice(0, 3).map((p) => (
              <DropdownMenuItem key={p.id} asChild onSelect={() => dismiss(`pending:${p.id}`)}>
                <Link to={`/musteriler/${p.customer_id}`} className="flex items-start gap-2">
                  <NotifIcon icon={PackageOpen} />
                  <span className="text-xs">
                    <span className="font-medium">{p.customers?.full_name ?? 'Doktor'}</span> için eksik ürün:{' '}
                    {p.product_name}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {visibleUpcomingCongresses.slice(0, 3).map((c) => (
              <DropdownMenuItem key={c.id} asChild onSelect={() => dismiss(`congress:${c.id}`)}>
                <Link to={`/kongreler/${c.id}`} className="flex items-start gap-2">
                  <NotifIcon icon={Presentation} tone="primary" />
                  <span className="text-xs">
                    <span className="font-medium">{c.name}</span> kongresi yaklaşıyor
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {visibleIncompleteChecklists.slice(0, 3).map((c) => (
              <DropdownMenuItem key={c.id} asChild onSelect={() => dismiss(`checklist:${c.id}`)}>
                <Link to={`/kongreler/${c.id}`} className="flex items-start gap-2">
                  <NotifIcon icon={ClipboardList} />
                  <span className="text-xs">
                    <span className="font-medium">{c.name}</span> kontrol listesi eksik (
                    {c.totalChecklistItems === 0
                      ? 'hiç madde yok'
                      : `${c.missingChecklistItems}/${c.totalChecklistItems} tamamlanmadı`}
                    )
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {visibleCongressStockShortfall.slice(0, 3).map((c) => (
              <DropdownMenuItem key={c.id} asChild onSelect={() => dismiss(`shortfall:${c.id}`)}>
                <Link to={`/kongreler/${c.congress_id}`} className="flex items-start gap-2">
                  <NotifIcon icon={Boxes} />
                  <span className="text-xs">
                    <span className="font-medium">{c.name}</span> bitti ama {c.productCount} üründe{' '}
                    {c.pendingQty} adet hâlâ "Götürüldü" durumunda — kullanıldı/döndü olarak işaretlenmedi
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={toggleColorMode}
          title={mode === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {mode === 'dark' ? <Sun className="size-[1.1rem]" /> : <Moon className="size-[1.1rem]" />}
        </button>

        {staff?.role === 'admin' && (
          <Link
            to="/ayarlar"
            title="Ayarlar"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <SettingsIcon className="size-[1.1rem]" />
          </Link>
        )}

        {staff?.role === 'admin' ? (
          <Link
            to="/ayarlar"
            className="ml-1 hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent sm:flex"
          >
            {CLINIC_NAME}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Link>
        ) : (
          <span className="ml-1 hidden items-center gap-1 px-2.5 py-1.5 text-sm font-medium text-foreground sm:flex">
            {CLINIC_NAME}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="ml-1 flex items-center gap-2 rounded-lg py-1 pr-1 pl-1.5 hover:bg-accent">
              <span className="relative">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/20 text-primary-foreground text-xs">
                    {initials(staff?.full_name || '?')}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    'absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background',
                    isOnline ? 'bg-success' : 'bg-destructive',
                  )}
                />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="truncate font-medium">{staff?.full_name}</p>
              <p className="text-muted-foreground text-xs font-normal">{staff ? tr.staffRole[staff.role] : ''}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => signOut()}>
              <LogOut /> Çıkış Yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export function AppShell() {
  const { staff } = useAuth()
  useApplyBrandTheme()
  useAIStartupCheck()
  const { mode, toggle: toggleColorMode } = useColorMode()
  const { data: iconSetId } = useAppSetting<string>('sidebar_icon_set')
  const iconSet = getIconSet(iconSetId)
  const isAdmin = staff?.role === 'admin'

  const { data: savedNavLayout } = useAppSetting<NavLayoutItem[]>('sidebar_nav_layout')
  const saveNavLayoutMutation = useSaveAppSetting<NavLayoutItem[]>('sidebar_nav_layout')
  const [navEditMode, setNavEditMode] = React.useState(false)
  const [draftNavLayout, setDraftNavLayout] = React.useState<NavLayoutItem[] | null>(null)
  const navDragIndexRef = React.useRef<number | null>(null)

  const navLayout = sanitizeNavLayout(draftNavLayout ?? savedNavLayout ?? defaultNavLayout)

  function startNavEditing() {
    setDraftNavLayout(navLayout)
    setNavEditMode(true)
  }

  function cancelNavEditing() {
    setDraftNavLayout(null)
    setNavEditMode(false)
  }

  async function saveNavLayout() {
    if (draftNavLayout) await saveNavLayoutMutation.mutateAsync(draftNavLayout)
    setNavEditMode(false)
  }

  function renameNavItem(key: NavKey, label: string) {
    setDraftNavLayout((prev) => (prev ?? navLayout).map((item) => (item.key === key ? { ...item, label } : item)))
  }

  function handleNavDrop(targetIndex: number) {
    const from = navDragIndexRef.current
    navDragIndexRef.current = null
    if (from === null || from === targetIndex) return
    setDraftNavLayout((prev) => {
      const list = [...(prev ?? navLayout)]
      const [moved] = list.splice(from, 1)
      list.splice(targetIndex, 0, moved)
      return list
    })
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <aside className="bg-sidebar text-sidebar-foreground relative flex w-64 shrink-0 flex-col overflow-hidden border-r border-sidebar-border">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-black/10"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col items-center gap-0.5 border-b border-sidebar-border/60 px-5 py-5">
          <ElffarmaLogo variant="premium" size="sm" />
        </div>

        {isAdmin && (
          <div className="relative z-10 flex items-center justify-end gap-1 px-3 pt-2">
            {!navEditMode ? (
              <button
                type="button"
                onClick={startNavEditing}
                title="Menüyü düzenle"
                className="flex size-6 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-white/10 hover:text-sidebar-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={cancelNavEditing}
                  title="Vazgeç"
                  className="flex size-6 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-white/10 hover:text-sidebar-foreground"
                >
                  <X className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={saveNavLayout}
                  title="Kaydet"
                  className="flex size-6 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-white/10 hover:text-sidebar-foreground"
                >
                  <Save className="size-3.5" />
                </button>
              </>
            )}
          </div>
        )}

        <nav className="relative z-10 flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
          {!navEditMode
            ? navLayout.map((item) => {
                const meta = navItemsByKey.get(item.key)!
                return (
                  <SidebarNavLink
                    key={item.key}
                    to={meta.to}
                    end={meta.end}
                    icon={iconSet.icons[item.key]}
                    label={item.label}
                    variant={iconSet.variant}
                    strokeWidth={iconSet.strokeWidth}
                  />
                )
              })
            : navLayout.map((item, index) => (
                <div
                  key={item.key}
                  draggable
                  onDragStart={() => (navDragIndexRef.current = index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleNavDrop(index)}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5"
                >
                  <GripVertical className="text-sidebar-foreground/40 size-3.5 shrink-0 cursor-grab" />
                  <Input
                    value={item.label}
                    onChange={(e) => renameNavItem(item.key, e.target.value)}
                    className="h-7 border-white/15 bg-white/10 px-2 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40"
                  />
                </div>
              ))}
          {staff?.role === 'admin' && (
            <SidebarNavLink
              to="/ayarlar"
              icon={iconSet.icons.settings}
              label={tr.nav.settings}
              variant={iconSet.variant}
              strokeWidth={iconSet.strokeWidth}
            />
          )}
        </nav>

        <div className="relative z-10 mx-3 mb-2 flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2.5">
          <Avatar className="size-10 shrink-0">
            <AvatarFallback className="bg-white/15 text-sidebar-foreground text-xs font-semibold">
              {initials(staff?.full_name || '?')}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">{staff?.full_name}</p>
            <p className="truncate text-xs text-sidebar-foreground/55">{staff ? tr.staffRole[staff.role] : ''}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[oklch(0.72_0.16_150)]">
              <span className="size-1.5 shrink-0 rounded-full bg-[oklch(0.72_0.16_150)]" /> Çevrimiçi
            </p>
          </div>
        </div>

        <p className="relative z-10 mx-3 mb-3 text-center text-[10px] text-sidebar-foreground/40">
          © {new Date().getFullYear()} {CLINIC_NAME}
          <br />
          Tüm hakları saklıdır.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar mode={mode} toggleColorMode={toggleColorMode} />
        <main className="relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--accent),transparent)]">
          <div className="mx-auto min-w-0 max-w-7xl p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      <AIChatWidget />
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="text-muted-foreground mt-1 text-sm">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
