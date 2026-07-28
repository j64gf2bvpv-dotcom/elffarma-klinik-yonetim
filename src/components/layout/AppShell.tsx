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
  Wallet,
  PackageOpen,
  CloudUpload,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useApplyBrandTheme } from '@/features/appSettings/useApplyBrandTheme'
import { useColorMode } from '@/features/appSettings/useColorMode'
import { useAppSetting } from '@/features/appSettings/hooks'
import { getIconSet, type IconVariant, type NavKey } from '@/features/appSettings/iconSets'
import { useAlertsSummary } from '@/features/alerts/useAlertsSummary'
import { useDismissedAlerts } from '@/features/alerts/useDismissedAlerts'
import { useAlertNotifications } from '@/features/alerts/useAlertNotifications'
import { useOfflineSync } from '@/features/offline/useOfflineSync'
import { queryClient } from '@/lib/queryClient'
import { getPaymentDueStatus } from '@/lib/paymentDue'
import { tr } from '@/i18n/tr'
import { ElffarmaLogo } from '@/components/brand/ElffarmaLogo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface NavConfigItem {
  key: NavKey
  label: string
}

export const navItems: { to: string; label: string; key: NavKey; end?: boolean }[] = [
  { to: '/', label: tr.nav.dashboard, key: 'dashboard', end: true },
  { to: '/stok', label: tr.nav.stock, key: 'stock' },
  { to: '/kongreler', label: tr.nav.congresses, key: 'congresses' },
  { to: '/workshoplar', label: tr.nav.workshops, key: 'workshops' },
  { to: '/tahsilatlar', label: tr.nav.payments, key: 'payments' },
  { to: '/giderler', label: tr.nav.expenses, key: 'expenses' },
  { to: '/satislar', label: tr.nav.sales, key: 'sales' },
  { to: '/cari-hesap', label: tr.nav.cariHesap, key: 'cariHesap' },
  { to: '/butce-yili', label: tr.nav.budget, key: 'budget' },
  { to: '/musteriler', label: tr.nav.customers, key: 'customers' },
  { to: '/doktor-ziyaretleri', label: tr.nav.doctorVisits, key: 'doctorVisits' },
  { to: '/hatirlatmalar', label: tr.nav.reminders, key: 'reminders' },
  { to: '/ajanda', label: tr.nav.agenda, key: 'agenda' },
  { to: '/e-fatura', label: tr.nav.eFatura, key: 'eFatura' },
]

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
              fill={variant === 'bold' ? 'currentColor' : 'none'}
              fillOpacity={variant === 'bold' ? 0.15 : undefined}
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

function TopBar() {
  const { staff, signOut } = useAuth()
  const isOnline = useOnlineStatus()
  const alerts = useAlertsSummary()
  const { dismissed, dismiss } = useDismissedAlerts()
  const { pendingCount, syncing, flush } = useOfflineSync()

  const visibleDueReminders = alerts.dueReminders.filter((r) => !dismissed.has(`reminder:${r.id}`))
  const visibleCriticalStock = alerts.criticalStock.filter((p) => !dismissed.has(`criticalStock:${p.id}`))
  const visibleExpiringProducts = alerts.expiringProducts.filter((p) => !dismissed.has(`expiring:${p.id}`))
  const visiblePaymentDue = alerts.paymentDue.filter((d) => !dismissed.has(`paymentDue:${d.id}`))
  const visibleDoctorsWithBalance = alerts.doctorsWithBalance.filter((d) => !dismissed.has(`balance:${d.id}`))
  const visiblePendingProducts = alerts.pendingProducts.filter((p) => !dismissed.has(`pending:${p.id}`))
  const visibleUpcomingCongresses = alerts.upcomingCongresses.filter((c) => !dismissed.has(`congress:${c.id}`))

  const visibleTotal =
    visibleDueReminders.length +
    visibleCriticalStock.length +
    visibleExpiringProducts.length +
    visiblePaymentDue.length +
    visibleDoctorsWithBalance.length +
    visiblePendingProducts.length

  const { hasUrgentAlerts } = useAlertNotifications(visiblePaymentDue, visibleCriticalStock)

  React.useEffect(() => {
    const interval = setInterval(
      () => {
        queryClient.invalidateQueries({ queryKey: ['products'] })
        queryClient.invalidateQueries({ queryKey: ['customers'] })
      },
      5 * 60_000,
    )
    return () => clearInterval(interval)
  }, [])

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                hasUrgentAlerts && 'animate-pulse text-destructive',
              )}
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
              <DropdownMenuItem key={r.id} asChild onClick={() => dismiss(`reminder:${r.id}`)}>
                <Link to="/hatirlatmalar" className="flex items-start gap-2">
                  <NotifIcon icon={BellRing} />
                  <span className="text-xs">
                    <span className="font-medium">{r.title}</span> hatırlatması
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {visibleCriticalStock.slice(0, 3).map((p) => (
              <DropdownMenuItem key={p.id} asChild onClick={() => dismiss(`criticalStock:${p.id}`)}>
                <Link to="/stok" className="flex items-start gap-2">
                  <NotifIcon icon={AlertTriangle} />
                  <span className="text-xs">
                    <span className="font-medium">{p.name}</span> kritik stok seviyesinde ({p.current_quantity} {p.unit})
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {visibleExpiringProducts.slice(0, 3).map((p) => (
              <DropdownMenuItem key={p.id} asChild onClick={() => dismiss(`expiring:${p.id}`)}>
                <Link to="/stok" className="flex items-start gap-2">
                  <NotifIcon icon={ClipboardX} />
                  <span className="text-xs">
                    <span className="font-medium">{p.name}</span> son kullanım tarihi{' '}
                    {p.expiry_date && new Date(p.expiry_date) < new Date() ? 'doldu' : 'yaklaşıyor'}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {visiblePaymentDue.slice(0, 3).map((d) => (
              <DropdownMenuItem key={d.id} asChild onClick={() => dismiss(`paymentDue:${d.id}`)}>
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
              <DropdownMenuItem key={d.id} asChild onClick={() => dismiss(`balance:${d.id}`)}>
                <Link to={`/musteriler/${d.id}`} className="flex items-start gap-2">
                  <NotifIcon icon={Wallet} />
                  <span className="text-xs">
                    <span className="font-medium">{d.full_name}</span> için eksik bakiye var
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            {visiblePendingProducts.slice(0, 3).map((p) => (
              <DropdownMenuItem key={p.id} asChild onClick={() => dismiss(`pending:${p.id}`)}>
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
              <DropdownMenuItem key={c.id} asChild onClick={() => dismiss(`congress:${c.id}`)}>
                <Link to={`/kongreler/${c.id}`} className="flex items-start gap-2">
                  <NotifIcon icon={Presentation} tone="primary" />
                  <span className="text-xs">
                    <span className="font-medium">{c.name}</span> kongresi yaklaşıyor
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {staff?.role === 'admin' && (
          <Link
            to="/ayarlar"
            title="Ayarlar"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <SettingsIcon className="size-[1.1rem]" />
          </Link>
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
  const { mode, toggle: toggleColorMode } = useColorMode()
  const { data: iconSetId } = useAppSetting<string>('sidebar_icon_set')
  const iconSet = getIconSet(iconSetId)
  const { data: navConfig } = useAppSetting<NavConfigItem[]>('sidebar_nav_config')

  const resolvedNavItems = React.useMemo(() => {
    if (!navConfig || navConfig.length === 0) return navItems
    const byKey = new Map(navItems.map((i) => [i.key, i]))
    const ordered = navConfig
      .filter((c) => byKey.has(c.key))
      .map((c) => ({ ...byKey.get(c.key)!, label: c.label.trim() || byKey.get(c.key)!.label }))
    const missing = navItems.filter((i) => !navConfig.some((c) => c.key === i.key))
    return [...ordered, ...missing]
  }, [navConfig])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <aside className="bg-sidebar text-sidebar-foreground relative flex w-64 shrink-0 flex-col overflow-hidden border-r border-sidebar-border">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-black/10"
          aria-hidden
        />
        <div className="relative z-10 border-b border-sidebar-border/60 px-5 py-5">
          <ElffarmaLogo variant="premium" />
        </div>

        <nav className="relative z-10 flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
          {resolvedNavItems.map((item) => (
            <SidebarNavLink
              key={item.to}
              to={item.to}
              end={item.end}
              icon={iconSet.icons[item.key]}
              label={item.label}
              variant={iconSet.variant}
              strokeWidth={iconSet.strokeWidth}
            />
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

        <div className="relative z-10 mx-3 mb-3 flex items-center justify-end px-2 py-1">
          <button
            type="button"
            onClick={toggleColorMode}
            title={mode === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
            className="flex size-6 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-white/10 hover:text-sidebar-foreground"
          >
            {mode === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="relative flex-1 overflow-y-auto bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--accent),transparent)]">
          <div className="mx-auto max-w-7xl p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
