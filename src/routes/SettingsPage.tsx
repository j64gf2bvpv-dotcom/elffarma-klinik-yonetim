import * as React from 'react'
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
  GripVertical,
  RotateCcw,
  LayoutPanelLeft,
} from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { companyInfo } from '@/lib/companyInfo'

import { PageHeader, navItems, type NavConfigItem } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStaffList, useUpdateStaff } from '@/features/staff/hooks'
import {
  useWhatsAppTemplates,
  useSaveWhatsAppTemplate,
  useDeleteWhatsAppTemplate,
} from '@/features/whatsapp/hooks'
import { useAppSetting, useSaveAppSetting } from '@/features/appSettings/hooks'
import { brandThemes } from '@/features/appSettings/brandThemes'
import { iconSets, defaultIconSetId } from '@/features/appSettings/iconSets'
import { useColorMode } from '@/features/appSettings/useColorMode'
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
    <div className="grid gap-3 sm:grid-cols-3">
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
                  )}
                >
                  <Icon
                    className="size-4"
                    strokeWidth={set.strokeWidth}
                    fill={set.variant === 'bold' ? 'currentColor' : 'none'}
                    fillOpacity={set.variant === 'bold' ? 0.15 : undefined}
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

const navDefaults: NavConfigItem[] = navItems.map((i) => ({ key: i.key, label: i.label }))
const navIconSet = iconSets.find((s) => s.id === defaultIconSetId) ?? iconSets[0]

function resolveNavConfig(saved: NavConfigItem[] | null | undefined): NavConfigItem[] {
  if (!saved || saved.length === 0) return navDefaults
  const byKey = new Map(navDefaults.map((d) => [d.key, d]))
  const ordered = saved.filter((c) => byKey.has(c.key)).map((c) => ({ key: c.key, label: c.label }))
  const missing = navDefaults.filter((d) => !saved.some((c) => c.key === d.key))
  return [...ordered, ...missing]
}

function SortableNavRow({
  item,
  defaultLabel,
  onLabelChange,
}: {
  item: NavConfigItem
  defaultLabel: string
  onLabelChange: (key: NavConfigItem['key'], label: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key })
  const Icon = navIconSet.icons[item.key]
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-2 rounded-lg border bg-card p-2', isDragging && 'opacity-60')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-muted-foreground flex size-7 shrink-0 cursor-grab touch-none items-center justify-center"
      >
        <GripVertical className="size-4" />
      </button>
      <Icon className="text-muted-foreground size-4 shrink-0" />
      <Input
        value={item.label}
        placeholder={defaultLabel}
        onChange={(e) => onLabelChange(item.key, e.target.value)}
        className="h-8"
      />
    </div>
  )
}

function SidebarNavCustomizer() {
  const { data: navConfig } = useAppSetting<NavConfigItem[]>('sidebar_nav_config')
  const saveMutation = useSaveAppSetting<NavConfigItem[]>('sidebar_nav_config')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const [items, setItems] = React.useState<NavConfigItem[]>(navDefaults)
  const initializedRef = React.useRef(false)

  React.useEffect(() => {
    if (initializedRef.current || navConfig === undefined) return
    setItems(resolveNavConfig(navConfig))
    initializedRef.current = true
  }, [navConfig])

  const dirty = JSON.stringify(items) !== JSON.stringify(resolveNavConfig(navConfig))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.key === active.id)
      const newIndex = prev.findIndex((i) => i.key === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  function handleLabelChange(key: NavConfigItem['key'], label: string) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, label } : i)))
  }

  async function handleSave() {
    await saveMutation.mutateAsync(items)
    toast.success('Menü sıralaması güncellendi')
  }

  async function handleReset() {
    setItems(navDefaults)
    await saveMutation.mutateAsync([])
    toast.success('Varsayılan menü sırasına dönüldü')
  }

  return (
    <div className="grid gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-2">
            {items.map((item) => (
              <SortableNavRow
                key={item.key}
                item={item}
                defaultLabel={navDefaults.find((d) => d.key === item.key)?.label ?? ''}
                onLabelChange={handleLabelChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleReset} disabled={saveMutation.isPending}>
          <RotateCcw className="size-3.5" /> Varsayılana Sıfırla
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!dirty || saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Kaydet
        </Button>
      </div>
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
              <p className="mb-2 text-sm font-medium">Menü Simge Seti</p>
              <IconSetPicker />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <PremiumIcon icon={LayoutPanelLeft} />
            <div>
              <CardTitle>Menü Özelleştirme</CardTitle>
              <CardDescription>
                Sol menüdeki panellerin adını değiştirin ve sürükleyerek sıralayın — tüm personel aynı düzeni görür.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <SidebarNavCustomizer />
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
      </div>
    </div>
  )
}
