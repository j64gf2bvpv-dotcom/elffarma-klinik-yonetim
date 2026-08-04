import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  AtSign,
  Share2,
  Globe,
  Phone,
  Mail,
  MapPin,
  UsersRound,
  MessageCircleMore,
  Palette,
  Check,
  Smartphone,
  Landmark,
  Copy,
  Receipt,
  Sun,
  Moon,
  FlaskConical,
} from 'lucide-react'
import { companyInfo } from '@/lib/companyInfo'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStaffList, useUpdateStaff } from '@/features/staff/hooks'
import {
  useWhatsAppTemplates,
  useSaveWhatsAppTemplate,
  useDeleteWhatsAppTemplate,
} from '@/features/whatsapp/hooks'
import { useAppSetting, useSaveAppSetting } from '@/features/appSettings/hooks'
import { AIProviderSettings } from '@/features/ai/AIProviderSettings'
import { brandThemes } from '@/features/appSettings/brandThemes'
import { iconSets, defaultIconSetId } from '@/features/appSettings/iconSets'
import { useColorMode } from '@/features/appSettings/useColorMode'
import { seedDemoData, clearDemoData } from '@/features/demoData/seedDemoData'
import { useAuth } from '@/lib/auth'
import { tr } from '@/i18n/tr'
import type { WhatsAppTemplate } from '@/types/database'
import { cn } from '@/lib/utils'

function PremiumIcon({
  icon: Icon,
  boxClassName = 'size-10',
  iconClassName = 'size-5',
}: {
  icon: React.ElementType
  boxClassName?: string
  iconClassName?: string
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-black/5 transition-transform duration-300 hover:scale-110 ${boxClassName}`}
    >
      <Icon className={iconClassName} />
    </span>
  )
}

function ContactTile({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ElementType
  label: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent"
    >
      <PremiumIcon icon={icon} />
      <span className="text-sm font-medium">{label}</span>
    </a>
  )
}

function ThemePicker() {
  const { data: brandTheme } = useAppSetting<{ hue: number; chromaScale?: number; special?: 'black_gold' }>(
    'brand_theme',
  )
  const saveMutation = useSaveAppSetting<{ hue: number; chromaScale?: number; special?: 'black_gold' }>(
    'brand_theme',
  )
  const activeId = brandTheme
    ? brandThemes.find(
        (t) =>
          t.hue === brandTheme.hue &&
          (t.chromaScale ?? 1) === (brandTheme.chromaScale ?? 1) &&
          t.special === brandTheme.special,
      )?.id
    : 'black_gold'

  return (
    <div className="flex flex-wrap gap-3">
      {brandThemes.map((themeOption) => {
        const chromaScale = themeOption.chromaScale ?? 1
        const isActive = activeId === themeOption.id
        const isBlackGold = themeOption.special === 'black_gold'
        return (
          <button
            key={themeOption.id}
            type="button"
            title={themeOption.label}
            disabled={saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({ hue: themeOption.hue, chromaScale, special: themeOption.special })
            }
            className={cn(
              'flex size-11 items-center justify-center rounded-full ring-2 ring-offset-2 transition-transform hover:scale-110',
              chromaScale === 0 && !isBlackGold && 'border border-border',
              isActive ? 'ring-foreground' : 'ring-transparent',
            )}
            style={
              isBlackGold
                ? {
                    background: 'linear-gradient(135deg, oklch(0.13 0.004 85), oklch(0.22 0.02 85))',
                    boxShadow: 'inset 0 0 0 2px oklch(0.78 0.14 85)',
                  }
                : { backgroundColor: `oklch(0.55 ${(0.18 * chromaScale).toFixed(4)} ${themeOption.hue})` }
            }
          >
            {isActive && (
              <Check
                className={cn(
                  'size-5 drop-shadow',
                  isBlackGold ? 'text-[oklch(0.78_0.14_85)]' : chromaScale === 0 ? 'text-foreground' : 'text-white',
                )}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

const HUE_GRADIENT =
  'linear-gradient(to right, oklch(0.7 0.18 0), oklch(0.7 0.18 60), oklch(0.7 0.18 120), oklch(0.7 0.18 180), oklch(0.7 0.18 240), oklch(0.7 0.18 300), oklch(0.7 0.18 360))'

const RANGE_THUMB_CLASSES =
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.4)] [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-foreground/20 [&::-webkit-slider-thumb]:cursor-pointer'

/**
 * Sabit preset renklerin (ThemePicker) yanında, kullanıcının HERHANGİ bir tonu
 * seçip önizleyip kendi isteğiyle uygulayabildiği serbest renk paneli — mevcut
 * hue-parametrik brandThemeCssVars motoru zaten 0-360 arası her tonu kabul
 * ediyor, burada sadece slider + önizleme + "Uygula" arayüzü ekleniyor.
 */
function CustomColorPicker() {
  const { data: brandTheme } = useAppSetting<{ hue: number; chromaScale?: number; special?: 'black_gold' }>(
    'brand_theme',
  )
  const saveMutation = useSaveAppSetting<{ hue: number; chromaScale?: number; special?: 'black_gold' }>('brand_theme')
  const [hue, setHue] = React.useState(brandTheme && !brandTheme.special ? brandTheme.hue : 250)
  const [chroma, setChroma] = React.useState(
    Math.round((brandTheme && !brandTheme.special ? (brandTheme.chromaScale ?? 1) : 1) * 100),
  )

  const previewColor = `oklch(0.55 ${(0.2 * (chroma / 100)).toFixed(4)} ${hue})`
  const isApplied =
    !!brandTheme && !brandTheme.special && brandTheme.hue === hue && Math.round((brandTheme.chromaScale ?? 1) * 100) === chroma

  return (
    <div className="grid gap-4 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <span
          className="ring-foreground/15 size-10 shrink-0 rounded-full ring-2 ring-offset-2"
          style={{ backgroundColor: previewColor }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-medium">Önizleme</p>
          <p className="text-sm font-medium tabular-nums">Ton {hue}° · Yoğunluk %{chroma}</p>
        </div>
        {isApplied && (
          <span className="text-primary flex shrink-0 items-center gap-1 text-xs font-medium">
            <Check className="size-3.5" /> Uygulandı
          </span>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="custom-hue">Renk tonu</Label>
        <input
          id="custom-hue"
          type="range"
          min={0}
          max={359}
          value={hue}
          onChange={(e) => setHue(Number(e.target.value))}
          className={cn('h-2 w-full cursor-pointer appearance-none rounded-full', RANGE_THUMB_CLASSES)}
          style={{ background: HUE_GRADIENT }}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="custom-chroma">Yoğunluk</Label>
        <input
          id="custom-chroma"
          type="range"
          min={10}
          max={100}
          value={chroma}
          onChange={(e) => setChroma(Number(e.target.value))}
          className={cn('bg-muted h-2 w-full cursor-pointer appearance-none rounded-full', RANGE_THUMB_CLASSES)}
        />
      </div>
      <Button
        size="sm"
        className="justify-self-start"
        onClick={() => saveMutation.mutate({ hue, chromaScale: chroma / 100 })}
        disabled={saveMutation.isPending || isApplied}
      >
        {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Check className="size-3.5" />}
        Bu Rengi Uygula
      </Button>
    </div>
  )
}

// black_gold gibi özel paletler hariç, tüm ton seçenekleri — Arkaplan/Kenar
// Çubuğu paletleri marka renginden bağımsız oldukları için özel temayı
// (siyah/gold) barındırmıyor.
const surfacePalette = brandThemes.filter((t) => !t.special)

/**
 * Marka renginden bağımsız, sadece ana içerik arkaplanını veya sol kenar
 * çubuğunu hedefleyen bir renk paleti. "Varsayılan" seçilirse ayar null'a
 * kaydedilir ve marka rengini takip etmeye geri döner (bkz.
 * useApplyBrandTheme).
 */
function SurfaceColorPicker({ settingKey }: { settingKey: 'background_theme' | 'sidebar_theme' }) {
  const { data: theme } = useAppSetting<{ hue: number; chromaScale?: number } | null>(settingKey)
  const saveMutation = useSaveAppSetting<{ hue: number; chromaScale?: number } | null>(settingKey)
  const activeId = theme
    ? surfacePalette.find((t) => t.hue === theme.hue && (t.chromaScale ?? 1) === (theme.chromaScale ?? 1))?.id
    : 'default'

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        title="Varsayılan (marka rengini takip eder)"
        disabled={saveMutation.isPending}
        onClick={() => saveMutation.mutate(null)}
        className={cn(
          'bg-muted flex size-11 items-center justify-center rounded-full border border-dashed border-border ring-2 ring-offset-2 transition-transform hover:scale-110',
          activeId === 'default' ? 'ring-foreground' : 'ring-transparent',
        )}
      >
        {activeId === 'default' && <Check className="size-5 text-foreground" />}
      </button>
      {surfacePalette.map((themeOption) => {
        const chromaScale = themeOption.chromaScale ?? 1
        const isActive = activeId === themeOption.id
        return (
          <button
            key={themeOption.id}
            type="button"
            title={themeOption.label}
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate({ hue: themeOption.hue, chromaScale })}
            className={cn(
              'flex size-11 items-center justify-center rounded-full ring-2 ring-offset-2 transition-transform hover:scale-110',
              chromaScale === 0 && 'border border-border',
              isActive ? 'ring-foreground' : 'ring-transparent',
            )}
            style={{ backgroundColor: `oklch(0.55 ${(0.18 * chromaScale).toFixed(4)} ${themeOption.hue})` }}
          >
            {isActive && (
              <Check className={cn('size-5 drop-shadow', chromaScale === 0 ? 'text-foreground' : 'text-white')} />
            )}
          </button>
        )
      })}
    </div>
  )
}

function ColorModePicker() {
  const { mode, setMode } = useColorMode()
  const options: { id: 'light' | 'dark'; label: string; icon: React.ElementType }[] = [
    { id: 'light', label: 'Açık', icon: Sun },
    { id: 'dark', label: 'Koyu', icon: Moon },
  ]

  return (
    <div className="flex gap-3">
      {options.map((option) => {
        const isActive = mode === option.id
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setMode(option.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'border-primary bg-primary/5' : 'hover:bg-accent',
            )}
          >
            <option.icon className={cn('size-4', isActive && 'text-primary')} />
            {option.label}
            {isActive && <Check className="size-3.5 text-primary" />}
          </button>
        )
      })}
    </div>
  )
}

function IconSetPicker() {
  const { data: iconSetId } = useAppSetting<string>('sidebar_icon_set')
  const saveMutation = useSaveAppSetting<string>('sidebar_icon_set')
  const activeId = iconSetId ?? defaultIconSetId

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {iconSets.map((set) => {
        const isActive = activeId === set.id
        const previewIcons = [set.icons.dashboard, set.icons.customers, set.icons.payments]
        return (
          <button
            key={set.id}
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(set.id)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors',
              isActive ? 'border-primary bg-primary/5' : 'hover:bg-accent',
            )}
          >
            <div className="flex items-center gap-2 rounded-lg bg-sidebar p-2.5">
              {previewIcons.map((Icon, i) => (
                <span
                  key={i}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/80',
                    set.variant === '3d' &&
                      'bg-gradient-to-br from-white/25 to-white/5 shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_2px_5px_-1px_rgba(0,0,0,0.5)] ring-1 ring-white/10',
                    set.variant === 'bold' && 'bg-white/15',
                    set.variant === 'outline' && 'bg-white/5',
                    set.variant === 'duotone' &&
                      'bg-gradient-to-br from-primary/25 to-primary/5 text-primary ring-1 ring-primary/20',
                    set.variant === 'thin' && 'bg-transparent',
                  )}
                >
                  <Icon
                    className="size-4"
                    strokeWidth={set.strokeWidth}
                    fill={set.variant === 'bold' || set.variant === 'duotone' ? 'currentColor' : 'none'}
                    fillOpacity={set.variant === 'bold' ? 0.15 : set.variant === 'duotone' ? 0.3 : undefined}
                  />
                </span>
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {isActive && <Check className="size-3.5 text-primary" />}
              {set.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TemplateRow({ template }: { template: WhatsAppTemplate }) {
  const [name, setName] = React.useState(template.name)
  const [body, setBody] = React.useState(template.body)
  const saveMutation = useSaveWhatsAppTemplate()
  const deleteMutation = useDeleteWhatsAppTemplate()
  const dirty = name !== template.name || body !== template.body

  return (
    <div className="grid gap-2 border-b py-4 last:border-b-0">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="font-medium" />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Kullanılabilir: {'{{ad}}'}, {'{{tarih}}'}, {'{{saat}}'}, {'{{klinik_adi}}'}, {'{{iban}}'}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => deleteMutation.mutate(template.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            size="sm"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate({ id: template.id, name, body })}
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Kaydet
          </Button>
        </div>
      </div>
    </div>
  )
}

function NewTemplateForm() {
  const [name, setName] = React.useState('')
  const [body, setBody] = React.useState('')
  const saveMutation = useSaveWhatsAppTemplate()

  async function handleAdd() {
    if (!name.trim() || !body.trim()) return
    await saveMutation.mutateAsync({ name, body })
    setName('')
    setBody('')
  }

  return (
    <div className="grid gap-2 pt-4">
      <Input placeholder="Şablon adı" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea
        placeholder="Merhaba {{ad}}, ..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={handleAdd} disabled={saveMutation.isPending}>
          <Plus /> Şablon Ekle
        </Button>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { staff: currentStaff } = useAuth()
  const { data: staffList = [] } = useStaffList()
  const { data: templates = [] } = useWhatsAppTemplates()
  const updateStaffMutation = useUpdateStaff()
  const queryClient = useQueryClient()
  const [seeding, setSeeding] = React.useState(false)
  const [clearing, setClearing] = React.useState(false)

  async function handleSeedDemoData() {
    setSeeding(true)
    try {
      const result = await seedDemoData()
      await queryClient.invalidateQueries()
      toast.success('Örnek veri eklendi', {
        description: `${result.customers} cari, ${result.products} ürün, ${result.payments} tahsilat, ${result.sales} satış, ${result.salesReps} temsilci, ${result.reminders} hatırlatma, ${result.congresses} kongre, ${result.visits} ziyaret, ${result.expenses} gider, ${result.sampleRequests} numune talebi, ${result.commissionRules} prim kuralı, ${result.clinics} klinik, ${result.crmActivities} CRM aktivitesi, ${result.crmOpportunities} CRM fırsatı, ${result.vehicles} araç, ${result.fuelLogs} yakıt kaydı, ${result.instagramLeads} Instagram doktoru`,
      })
    } catch (err) {
      toast.error('Örnek veri eklenemedi', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSeeding(false)
    }
  }

  async function handleClearDemoData() {
    if (!confirm('Tüm örnek veriler (örnek cariler, ürünler, temsilciler, hatırlatmalar, kongreler, ziyaretler, giderler, klinikler, araçlar, Instagram doktorları ve bunlara bağlı tahsilat/satış/numune/CRM/yakıt kayıtları) kalıcı olarak silinsin mi?')) return
    setClearing(true)
    try {
      const result = await clearDemoData()
      await queryClient.invalidateQueries()
      toast.success('Örnek veriler silindi', {
        description: `${result.customersDeleted} cari, ${result.productsDeleted} ürün, ${result.salesRepsDeleted} temsilci, ${result.remindersDeleted} hatırlatma, ${result.congressesDeleted} kongre, ${result.visitsDeleted} ziyaret, ${result.expensesDeleted} gider, ${result.commissionRulesDeleted} prim kuralı, ${result.clinicsDeleted} klinik, ${result.vehiclesDeleted} araç, ${result.instagramLeadsDeleted} Instagram doktoru kaldırıldı`,
      })
    } catch (err) {
      toast.error('Örnek veriler silinemedi', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setClearing(false)
    }
  }

  return (
    <div>
      <PageHeader title="Ayarlar" description="Personel yönetimi ve WhatsApp mesaj şablonları" />

      <div className="grid gap-6">
        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <PremiumIcon icon={Palette} />
            <div>
              <CardTitle>Görünüm</CardTitle>
              <CardDescription>Uygulamanın marka rengini seçin — panel, menü ve butonlara yansır.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div>
              <p className="mb-2 text-sm font-medium">Görünüm Modu</p>
              <ColorModePicker />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Marka Rengi</p>
              <ThemePicker />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Özel Renk Paneli</p>
              <CustomColorPicker />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Arkaplan Rengi</p>
              <SurfaceColorPicker settingKey="background_theme" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Kenar Çubuğu (Yan Panel) Rengi</p>
              <SurfaceColorPicker settingKey="sidebar_theme" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Menü Simge Seti</p>
              <IconSetPicker />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <PremiumIcon icon={UsersRound} />
            <div>
              <CardTitle>Personel</CardTitle>
              <CardDescription>
                Yeni personel eklemek için Supabase Dashboard {'>'} Authentication {'>'} Users
                bölümünden hesap oluşturun; burada rol ve aktiflik durumunu yönetebilirsiniz.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffList.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.full_name}
                      {member.id === currentStaff?.id && (
                        <Badge variant="secondary" className="ml-2">
                          Siz
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onValueChange={(role) =>
                          updateStaffMutation.mutate({ id: member.id, input: { role: role as 'admin' | 'staff' } })
                        }
                        disabled={member.id === currentStaff?.id}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(tr.staffRole).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={member.is_active ? 'outline' : 'destructive'}
                        disabled={member.id === currentStaff?.id}
                        onClick={() =>
                          updateStaffMutation.mutate({
                            id: member.id,
                            input: { is_active: !member.is_active },
                          })
                        }
                      >
                        {member.is_active ? 'Aktif' : 'Pasif'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <PremiumIcon icon={MessageCircleMore} />
            <div>
              <CardTitle>WhatsApp Mesaj Şablonları</CardTitle>
              <CardDescription>
                Doktorlara gönderilecek WhatsApp mesajlarında kullanılacak hazır metinler.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {templates.map((template) => (
              <TemplateRow key={template.id} template={template} />
            ))}
            <NewTemplateForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <PremiumIcon icon={Globe} />
            <div>
              <CardTitle>Kurumsal Bilgiler</CardTitle>
              <CardDescription>{companyInfo.legalName}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <ContactTile href="https://elffarma.com" icon={Globe} label="elffarma.com" />
            <ContactTile
              href="https://instagram.com/elffarma"
              icon={AtSign}
              label="@elffarma (Instagram)"
            />
            <ContactTile
              href="https://facebook.com/elffarmatr"
              icon={Share2}
              label="elffarmatr (Facebook)"
            />
            <ContactTile href="tel:+903123097979" icon={Phone} label={companyInfo.phone} />
            <ContactTile href="tel:+905065145477" icon={Smartphone} label={companyInfo.mobile + ' (Cep)'} />
            <ContactTile href="mailto:info@elffarma.com" icon={Mail} label={companyInfo.email} />
            <ContactTile
              href="https://maps.google.com/?q=100.Yıl+Mahallesi+Kuleli+Caddesi+No:7+Çankaya+Ankara"
              icon={MapPin}
              label={companyInfo.address}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <PremiumIcon icon={Receipt} />
            <div>
              <CardTitle>Fatura & Banka Bilgileri</CardTitle>
              <CardDescription>
                Doktorlara tahsilat için gönderilecek IBAN ve vergi bilgileri — WhatsApp şablonlarında{' '}
                {'{{iban}}'} olarak da kullanılabilir.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">VERGİ DAİRESİ</p>
              <p>{companyInfo.taxOffice}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">VKN</p>
              <p>{companyInfo.taxNumber}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">BANKA / IBAN</p>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <Landmark className="size-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">
                    {companyInfo.bankName} — {companyInfo.accountType}
                  </p>
                  <p className="font-mono text-muted-foreground">{companyInfo.iban}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(companyInfo.iban.replace(/\s/g, ''))
                    toast.success('IBAN kopyalandı')
                  }}
                >
                  <Copy className="size-3.5" /> Kopyala
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {currentStaff?.role === 'admin' && (
          <Card>
            <CardHeader className="flex-row items-center gap-3">
              <PremiumIcon icon={FlaskConical} />
              <div>
                <CardTitle>Örnek/Deneme Verisi</CardTitle>
                <CardDescription>
                  Panel grafiklerini ve tüm ekranları gerçek veriyle görmek için birkaç örnek doktor, ürün
                  (SKT'si yaklaşan bir lot dahil), tahsilat, satış, temsilci, hatırlatma, kongre (paket
                  fiyatlarıyla), ziyaret, gider, numune talebi, bir prim kuralı, klinik ve CRM aktivitesi/fırsatı
                  (Yeni'den Kaybedildi'ye kadar tüm CRM aşamalarında) ekler — Panel'deki hemen hemen tüm
                  widget'lar ve Klinikler/CRM/Numuneler/Prim sayfaları bu veriyle dolar. Adları/başlıkları
                  "[Örnek]" ile işaretlenir, tek tıkla geri silinebilir — gerçek verilerinize dokunmaz. (Bütçe
                  hedefleri, gerçek verinizi yanlışlıkla ezmemek için bilerek dahil edilmedi.)
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={handleSeedDemoData} disabled={seeding || clearing}>
                {seeding && <Loader2 className="animate-spin" />}
                Örnek Veri Ekle
              </Button>
              <Button variant="outline" onClick={handleClearDemoData} disabled={seeding || clearing}>
                {clearing && <Loader2 className="animate-spin" />}
                <Trash2 className="size-4" /> Örnek Verileri Sil
              </Button>
            </CardContent>
          </Card>
        )}

        <AIProviderSettings />
      </div>
    </div>
  )
}
