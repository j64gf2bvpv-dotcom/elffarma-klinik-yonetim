import * as React from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { AppModal } from '@/components/ui/AppModal'
import * as ImagePicker from 'expo-image-picker'
import { format, isPast, isToday, startOfMonth } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import {
  Phone,
  MessageCircle,
  Navigation,
  Stethoscope,
  Star,
  Mail,
  Video,
  Users,
  StickyNote,
  TrendingUp,
  ShoppingCart,
  Calendar,
  Sparkles,
  X,
  Presentation,
  FileText,
  Camera,
  Trash2,
  HandCoins,
  Receipt,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Toast from 'react-native-toast-message'
import { Screen } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useCustomer, useUpdateCustomerNotes } from '@/features/customers/hooks'
import {
  usePayments,
  useCreatePayment,
  useSaveInvoice,
  useInvoiceFileUrl,
  useInstallmentPlans,
  useAllInstallments,
  useCreateInstallmentPlan,
  useMarkInstallmentPaid,
} from '@/features/payments/hooks'
import { createPayment } from '@/features/payments/api'
import { useSales } from '@/features/sales/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import { useCrmActivities } from '@/features/crm/hooks'
import { useOpportunities } from '@/features/opportunities/hooks'
import { useVisits } from '@/features/doctorVisits/hooks'
import { useParticipationsByDoctorName } from '@/features/congresses/hooks'
import { useAttachments, useUploadAttachment, useAttachmentUrl, useDeleteAttachment } from '@/features/attachments/hooks'
import { useCustomerTarget, useUpsertCustomerTarget } from '@/features/customerTargets/hooks'
import { computeCariLedger, cariBalance } from '@shared/businessLogic/cariLedger'
import { summarizeDoctorForRep } from '@/features/ai/doctorSummary'
import { AIServiceError } from '@/features/ai/types'
import { tr } from '@shared/i18n/tr'
import type { DoctorsStackParamList } from '@/navigation/types'
import type { CrmOpportunityStage, PaymentMethod } from '@shared/types/database'
import type { InstallmentWithPlan, PaymentWithCustomer } from '@/features/payments/api'

type Props = NativeStackScreenProps<DoctorsStackParamList, 'DoctorDetail'>

type TabKey = 'genel' | 'aktiviteler' | 'siparisler' | 'tahsilat' | 'firsatlar' | 'ziyaretler' | 'etkinlikler' | 'belgeler'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'genel', label: 'Genel' },
  { key: 'aktiviteler', label: 'Aktiviteler' },
  { key: 'siparisler', label: 'Siparişler' },
  { key: 'tahsilat', label: 'Tahsilat' },
  { key: 'firsatlar', label: 'Fırsatlar' },
  { key: 'ziyaretler', label: 'Ziyaretler' },
  { key: 'etkinlikler', label: 'Etkinlikler' },
  { key: 'belgeler', label: 'Belgeler' },
]

const activityIcons: Record<string, LucideIcon> = {
  arama: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  toplanti: Users,
  video_gorusme: Video,
  not: StickyNote,
}

const stageLabels: Record<CrmOpportunityStage, string> = {
  yeni: 'Yeni',
  teklif: 'Teklif',
  muzakere: 'Müzakere',
  kazanildi: 'Kazanıldı',
  kaybedildi: 'Kaybedildi',
}

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

/**
 * Master talimat mockup'ındaki "Doktor Detay" ekranı — üstte hızlı aksiyon
 * butonları (Ara/WhatsApp/Yol Tarifi/Ziyaret), CRM özet kartı (son görüşme,
 * son sipariş, toplam satış, bakiye, açık fırsat, sonraki takip) ve
 * Genel/Aktiviteler/Siparişler/Fırsatlar/Ziyaretler sekmeleri tek ekranda.
 * "Bu doktor kim? Ne konuştuk? Borcu var mı? Şimdi ne yapmalıyım?" sorularının
 * hepsi buradan cevaplanabilsin diye tüm veri kaynakları (crm_activities,
 * sales, payments, invoices, crm_opportunities, doctor_visits) tek yerde
 * birleştirildi.
 */
export function DoctorDetailScreen({ route, navigation }: Props) {
  const { customerId, customerName } = route.params
  const theme = useTheme()
  const [tab, setTab] = React.useState<TabKey>('genel')
  const [aiSummary, setAiSummary] = React.useState<string | null>(null)
  const [aiLoading, setAiLoading] = React.useState(false)
  const [aiError, setAiError] = React.useState<string | null>(null)
  const [showAiModal, setShowAiModal] = React.useState(false)
  const [showTargetModal, setShowTargetModal] = React.useState(false)
  const [targetInput, setTargetInput] = React.useState('')
  React.useLayoutEffect(() => navigation.setOptions({ title: customerName }), [navigation, customerName])

  const now = new Date()
  const { data: target } = useCustomerTarget(customerId, now.getFullYear(), now.getMonth() + 1)
  const upsertTarget = useUpsertCustomerTarget()

  const { data: customer } = useCustomer(customerId)
  const { data: allPayments = [] } = usePayments({})
  const { data: allSales = [] } = useSales()
  const { data: allInvoices = [] } = useInvoices()
  const { data: allActivities = [] } = useCrmActivities()
  const { data: allOpportunities = [] } = useOpportunities('all')
  const { data: allVisits = [] } = useVisits()
  const { data: participations = [] } = useParticipationsByDoctorName(customer?.full_name)

  const sales = React.useMemo(() => allSales.filter((s) => s.customer_id === customerId), [allSales, customerId])
  const payments = React.useMemo(
    () => [...allPayments].filter((p) => p.customer_id === customerId).sort((a, b) => b.paid_at.localeCompare(a.paid_at)),
    [allPayments, customerId],
  )
  const activities = React.useMemo(() => allActivities.filter((a) => a.customer_id === customerId), [allActivities, customerId])
  const opportunities = React.useMemo(() => allOpportunities.filter((o) => o.customer_id === customerId), [allOpportunities, customerId])
  const visits = React.useMemo(() => allVisits.filter((v) => v.customer_id === customerId), [allVisits, customerId])

  const ledger = React.useMemo(() => computeCariLedger(allPayments, allSales, allInvoices), [allPayments, allSales, allInvoices])
  const balance = cariBalance(ledger, customerId)
  const totalSales = React.useMemo(
    () => sales.filter((s) => s.type === 'sale').reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0),
    [sales],
  )
  const monthStart = startOfMonth(now)
  const monthSales = React.useMemo(
    () =>
      sales
        .filter((s) => s.type === 'sale' && new Date(s.sale_date) >= monthStart)
        .reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0),
    [sales, monthStart],
  )
  const lastActivity = activities[0]
  const lastSale = sales[0]
  const openOpportunity = opportunities.find((o) => o.stage !== 'kazanildi' && o.stage !== 'kaybedildi')
  const nextFollowUp = [...activities]
    .filter((a) => a.follow_up_date)
    .sort((a, b) => (a.follow_up_date ?? '').localeCompare(b.follow_up_date ?? ''))[0]?.follow_up_date

  const whatsappNumber = customer?.whatsapp_phone || customer?.phone
  const directionsUrl =
    customer?.latitude != null && customer?.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${customer.latitude},${customer.longitude}`
      : null

  const overdueVisitCount = visits.filter(
    (v) => v.next_visit_date && isPast(new Date(v.next_visit_date)) && !isToday(new Date(v.next_visit_date)),
  ).length

  async function onAiSummarize() {
    setShowAiModal(true)
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await summarizeDoctorForRep({
        doctorName: customer?.full_name ?? customerName,
        specialty: customer?.specialty ?? null,
        hospitalName: customer?.hospital_name ?? null,
        lastActivityDate: lastActivity ? format(new Date(lastActivity.occurred_at), 'd MMMM yyyy', { locale: trLocale }) : null,
        lastActivityType: lastActivity ? (tr.crmActivityType[lastActivity.activity_type] ?? lastActivity.activity_type) : null,
        lastSaleDate: lastSale ? format(new Date(lastSale.sale_date), 'd MMMM yyyy', { locale: trLocale }) : null,
        totalSales,
        balance,
        openOpportunityTitle: openOpportunity?.title ?? null,
        nextFollowUpDate: nextFollowUp ? format(new Date(nextFollowUp), 'd MMMM yyyy', { locale: trLocale }) : null,
        overdueVisitCount,
      })
      setAiSummary(result)
    } catch (err) {
      const message = err instanceof AIServiceError ? err.message : err instanceof Error ? err.message : 'Bilinmeyen hata'
      setAiError(message)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <Screen scroll style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: theme.colors.primary + '26',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Stethoscope size={22} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }} numberOfLines={1}>
              {customer?.full_name ?? customerName}
            </Text>
            {customer?.is_vip && <Star size={14} color={theme.colors.warning} fill={theme.colors.warning} />}
          </View>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
            {[customer?.specialty, customer?.hospital_name].filter(Boolean).join(' · ') || 'Doktor'}
          </Text>
        </View>
        <Badge variant={customer?.is_active === false ? 'outline' : 'success'}>
          {customer?.is_active === false ? 'Pasif' : 'Aktif'}
        </Badge>
      </View>

      {/* Önceden yatay ScrollView'dı — 5. buton ekran dışında kayıyor,
          kullanıcı kaydırmayı fark etmiyordu. Artık sığmayan butonlar
          ikinci satıra sarılıyor, hepsi tek bakışta görünüyor. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <QuickAction icon={Phone} label="Ara" onPress={() => customer?.phone && Linking.openURL(`tel:${customer.phone}`)} />
        <QuickAction
          icon={MessageCircle}
          label="WhatsApp"
          onPress={() => whatsappNumber && Linking.openURL(`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`)}
        />
        <QuickAction icon={Navigation} label="Yol Tarifi" onPress={() => directionsUrl && Linking.openURL(directionsUrl)} disabled={!directionsUrl} />
        <QuickAction
          icon={Calendar}
          label="Ziyaret"
          onPress={() => navigation.navigate('VisitFlow', { customerId, customerName: customer?.full_name ?? customerName })}
        />
        <QuickAction
          icon={ShoppingCart}
          label="Yeni Sipariş"
          onPress={() => navigation.navigate('CreateOrder', { customerId, customerName: customer?.full_name ?? customerName })}
        />
      </View>

      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, fontWeight: '600' }}>
            CRM Özeti
          </Text>
          <Pressable onPress={onAiSummarize} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Sparkles size={14} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.primary, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>AI Özet</Text>
          </Pressable>
        </View>
        <Card style={{ gap: 10 }}>
          <SummaryRow
            label="Son Görüşme"
            value={lastActivity ? format(new Date(lastActivity.occurred_at), 'd MMMM yyyy', { locale: trLocale }) : '—'}
          />
          <SummaryRow label="Son Sipariş" value={lastSale ? format(new Date(lastSale.sale_date), 'd MMMM yyyy', { locale: trLocale }) : '—'} />
          <SummaryRow label="Toplam Satış" value={currency(totalSales)} />
          <Pressable
            onPress={() => {
              setTargetInput(target?.target_revenue != null ? String(target.target_revenue) : '')
              setShowTargetModal(true)
            }}
            style={{ gap: 4 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
                {format(now, 'MMMM', { locale: trLocale })} Hedefi
              </Text>
              <Text style={{ color: theme.colors.primary, fontSize: theme.fontSizes.sm, fontWeight: '600' }}>
                {target?.target_revenue ? `${currency(monthSales)} / ${currency(target.target_revenue)}` : 'Hedef belirle'}
              </Text>
            </View>
            {target?.target_revenue != null && target.target_revenue > 0 && (
              <ProgressBar
                ratio={monthSales / target.target_revenue}
                color={monthSales >= target.target_revenue ? theme.colors.success : theme.colors.primary}
              />
            )}
          </Pressable>
          <SummaryRow
            label="Bakiye"
            value={currency(balance)}
            valueColor={balance > 0 ? theme.colors.destructive : theme.colors.success}
          />
          <SummaryRow label="Açık Fırsat" value={openOpportunity?.title ?? 'Yok'} />
          <SummaryRow
            label="Sonraki Takip"
            value={nextFollowUp ? format(new Date(nextFollowUp), 'd MMMM yyyy', { locale: trLocale }) : 'Planlanmadı'}
          />
        </Card>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {tabs.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} hitSlop={4}>
            <Badge variant={tab === t.key ? 'default' : 'outline'}>{t.label}</Badge>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'genel' && (
        <View style={{ gap: 10 }}>
          <Card style={{ gap: 8 }}>
            <SummaryRow label="Telefon" value={customer?.phone ?? '—'} />
            <SummaryRow label="E-posta" value={customer?.email ?? '—'} />
            <SummaryRow label="İl / İlçe" value={[customer?.province, customer?.district].filter(Boolean).join(' / ') || '—'} />
            <SummaryRow label="Klinik" value={customer?.hospital_name ?? '—'} />
          </Card>
          {customer && <NotesEditor customerId={customer.id} initialNotes={customer.notes} />}
        </View>
      )}

      {tab === 'aktiviteler' && (
        <View style={{ gap: 8 }}>
          {activities.length === 0 && <Text style={{ color: theme.colors.mutedForeground }}>Aktivite yok</Text>}
          {activities.map((a) => (
            <ListItemCard
              key={a.id}
              icon={activityIcons[a.activity_type] ?? StickyNote}
              title={tr.crmActivityType[a.activity_type] ?? a.activity_type}
              subtitle={[a.subject, format(new Date(a.occurred_at), 'd MMM yyyy HH:mm', { locale: trLocale })].filter(Boolean).join(' · ')}
            />
          ))}
        </View>
      )}

      {tab === 'siparisler' && (
        <View style={{ gap: 8 }}>
          <Button
            variant="outline"
            size="sm"
            onPress={() => navigation.navigate('CreateOrder', { customerId, customerName: customer?.full_name ?? customerName })}
          >
            + Yeni Sipariş
          </Button>
          {sales.length === 0 && <Text style={{ color: theme.colors.mutedForeground }}>Sipariş yok</Text>}
          {sales.map((s) => (
            <ListItemCard
              key={s.id}
              icon={ShoppingCart}
              iconColor={s.type === 'sale' ? theme.colors.success : theme.colors.destructive}
              title={s.product_name}
              subtitle={`${s.quantity} adet · ${format(new Date(s.sale_date), 'd MMM yyyy', { locale: trLocale })}`}
              right={<Text style={{ color: theme.colors.foreground, fontWeight: '700' }}>{currency(s.quantity * Number(s.unit_price))}</Text>}
            />
          ))}
        </View>
      )}

      {tab === 'tahsilat' && (
        <PaymentsSection customerId={customerId} customerName={customer?.full_name ?? customerName} payments={payments} />
      )}

      {tab === 'firsatlar' && (
        <View style={{ gap: 8 }}>
          <Button
            variant="outline"
            size="sm"
            onPress={() => navigation.navigate('CreateQuote', { customerId, customerName: customer?.full_name ?? customerName })}
          >
            + Teklif Oluştur
          </Button>
          {opportunities.length === 0 && <Text style={{ color: theme.colors.mutedForeground }}>Fırsat yok</Text>}
          {opportunities.map((o) => (
            <ListItemCard
              key={o.id}
              icon={TrendingUp}
              iconColor={o.stage === 'kazanildi' ? theme.colors.success : o.stage === 'kaybedildi' ? theme.colors.destructive : theme.colors.primary}
              title={o.title}
              subtitle={stageLabels[o.stage]}
              right={o.amount != null ? <Text style={{ color: theme.colors.foreground, fontWeight: '700' }}>{currency(o.amount)}</Text> : undefined}
            />
          ))}
        </View>
      )}

      {tab === 'ziyaretler' && (
        <View style={{ gap: 8 }}>
          {visits.length === 0 && <Text style={{ color: theme.colors.mutedForeground }}>Ziyaret yok</Text>}
          {visits.map((v) => (
            <ListItemCard
              key={v.id}
              icon={Stethoscope}
              iconColor={v.check_in_at && !v.check_out_at ? theme.colors.success : theme.colors.mutedForeground}
              title={format(new Date(v.visit_date), 'd MMMM yyyy', { locale: trLocale })}
              subtitle={v.discussed_products ?? v.notes ?? undefined}
              right={v.check_in_at && !v.check_out_at ? <Badge variant="default">Aktif</Badge> : undefined}
            />
          ))}
        </View>
      )}

      {tab === 'belgeler' && <AttachmentsSection customerId={customerId} />}

      {tab === 'etkinlikler' && (
        <View style={{ gap: 8 }}>
          {participations.length === 0 && <Text style={{ color: theme.colors.mutedForeground }}>Etkinlik katılımı yok</Text>}
          {participations.map((p) => (
            <ListItemCard
              key={p.id}
              icon={Presentation}
              iconColor={p.attendance_status === 'attended' ? theme.colors.success : theme.colors.mutedForeground}
              title={p.congresses?.name ?? 'Etkinlik'}
              subtitle={p.congresses?.start_date ? format(new Date(p.congresses.start_date), 'd MMMM yyyy', { locale: trLocale }) : undefined}
              right={
                <Badge variant={p.attendance_status === 'attended' ? 'success' : p.attendance_status === 'no_show' ? 'destructive' : 'outline'}>
                  {p.attendance_status === 'attended' ? 'Katıldı' : p.attendance_status === 'no_show' ? 'Gelmedi' : 'Davetli'}
                </Badge>
              }
            />
          ))}
        </View>
      )}

      <AppModal visible={showAiModal} animationType="slide" transparent onRequestClose={() => setShowAiModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.spacing(5), gap: 14, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>AI Özet</Text>
              </View>
              <Pressable onPress={() => setShowAiModal(false)} hitSlop={12}>
                <X size={22} color={theme.colors.foreground} />
              </Pressable>
            </View>
            {aiLoading && (
              <View style={{ paddingVertical: 24, alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>Özet hazırlanıyor...</Text>
              </View>
            )}
            {!aiLoading && aiError && (
              <Text style={{ color: theme.colors.destructive, fontSize: theme.fontSizes.sm }}>{aiError}</Text>
            )}
            {!aiLoading && !aiError && aiSummary && (
              <ScrollView>
                <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.base, lineHeight: 22 }}>{aiSummary}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </AppModal>

      <AppModal visible={showTargetModal} animationType="slide" transparent onRequestClose={() => setShowTargetModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
          <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.spacing(5), gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>
                {format(now, 'MMMM yyyy', { locale: trLocale })} Ciro Hedefi
              </Text>
              <Pressable onPress={() => setShowTargetModal(false)} hitSlop={12}>
                <X size={22} color={theme.colors.foreground} />
              </Pressable>
            </View>
            <TextField label="Hedef Tutar (₺)" value={targetInput} onChangeText={setTargetInput} keyboardType="numeric" placeholder="0" />
            <Button
              onPress={async () => {
                const value = Number(targetInput)
                if (!value || value <= 0) return
                await upsertTarget.mutateAsync({ customerId, year: now.getFullYear(), month: now.getMonth() + 1, targetRevenue: value })
                setShowTargetModal(false)
              }}
              loading={upsertTarget.isPending}
              disabled={!Number(targetInput)}
            >
              Kaydet
            </Button>
          </View>
        </View>
      </AppModal>
    </Screen>
  )
}

function QuickAction({
  icon: Icon,
  label,
  onPress,
  disabled,
}: {
  icon: LucideIcon
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  const theme = useTheme()
  return (
    <Button variant="outline" size="sm" onPress={onPress} disabled={disabled} style={{ width: 96, flexDirection: 'column', height: 56, gap: 2 }}>
      <Icon size={16} color={disabled ? theme.colors.mutedForeground : theme.colors.primary} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{ color: disabled ? theme.colors.mutedForeground : theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}
      >
        {label}
      </Text>
    </Button>
  )
}

function NotesEditor({ customerId, initialNotes }: { customerId: string; initialNotes: string | null }) {
  const theme = useTheme()
  const updateNotes = useUpdateCustomerNotes()
  const [notes, setNotes] = React.useState(initialNotes ?? '')
  const [dirty, setDirty] = React.useState(false)

  React.useEffect(() => {
    if (!dirty) setNotes(initialNotes ?? '')
  }, [initialNotes, dirty])

  return (
    <Card style={{ gap: 8 }}>
      <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>Notlar</Text>
      <TextField
        value={notes}
        onChangeText={(v) => {
          setNotes(v)
          setDirty(true)
        }}
        placeholder="Bu doktorla ilgili not ekleyin..."
        multiline
      />
      {dirty && (
        <Button
          size="sm"
          onPress={async () => {
            await updateNotes.mutateAsync({ id: customerId, notes: notes.trim() || null })
            setDirty(false)
          }}
          loading={updateNotes.isPending}
        >
          Notu Kaydet
        </Button>
      )}
    </Card>
  )
}

function currencyCompact(n: number) {
  return Number(n).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

const PAYMENT_METHODS: PaymentMethod[] = ['nakit', 'kredi_karti', 'havale', 'pos']

/**
 * "Tahsilat" sekmesi — masaüstündeki PaymentsPage/InvoiceDialog/
 * InstallmentPlanForm/CollectInstallmentDialog'un bu doktora özel mobil
 * karşılığı: tahsilat kaydı ekleme, her tahsilata fatura no/dosyası
 * (invoices private bucket, aynı payments.invoice_number/invoice_file_path
 * kolonları) ekleme/görüntüleme, taksitli plan oluşturma ve taksit tahsil
 * etme. Aynı payment_installment_plans/payment_installments tabloları ve
 * aynı taksit tutarı hesaplama mantığı (küsurat son taksite yazılır).
 */
function PaymentsSection({
  customerId,
  customerName,
  payments,
}: {
  customerId: string
  customerName: string
  payments: PaymentWithCustomer[]
}) {
  const theme = useTheme()
  const [showAddPayment, setShowAddPayment] = React.useState(false)
  const [showInstallmentPlan, setShowInstallmentPlan] = React.useState(false)
  const [invoicePayment, setInvoicePayment] = React.useState<PaymentWithCustomer | null>(null)
  const [collectInstallment, setCollectInstallment] = React.useState<InstallmentWithPlan | null>(null)

  const { data: installmentPlans = [] } = useInstallmentPlans(customerId)
  const { data: allInstallments = [] } = useAllInstallments()

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button variant="outline" size="sm" style={{ flex: 1 }} onPress={() => setShowAddPayment(true)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <HandCoins size={15} color={theme.colors.foreground} />
            <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>+ Yeni Tahsilat</Text>
          </View>
        </Button>
        <Button variant="outline" size="sm" style={{ flex: 1 }} onPress={() => setShowInstallmentPlan(true)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <CalendarClock size={15} color={theme.colors.foreground} />
            <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>Taksitli Plan</Text>
          </View>
        </Button>
      </View>

      {payments.length === 0 && <Text style={{ color: theme.colors.mutedForeground }}>Tahsilat yok</Text>}
      {payments.map((p) => (
        <ListItemCard
          key={p.id}
          icon={HandCoins}
          iconColor={theme.colors.success}
          title={currencyCompact(Number(p.amount))}
          subtitle={[tr.paymentMethod[p.payment_method] ?? p.payment_method, format(new Date(p.paid_at), 'd MMM yyyy', { locale: trLocale })].join(' · ')}
          onPress={() => setInvoicePayment(p)}
          right={
            <Pressable onPress={() => setInvoicePayment(p)} hitSlop={8}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Receipt size={11} color={theme.colors.mutedForeground} />
                <Badge variant={p.invoice_number || p.invoice_file_path ? 'secondary' : 'outline'}>
                  {p.invoice_number || (p.invoice_file_path ? 'Fatura' : 'Fatura Ekle')}
                </Badge>
              </View>
            </Pressable>
          }
        />
      ))}

      {installmentPlans.length > 0 && (
        <View style={{ gap: 8, marginTop: 6 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.base, fontWeight: '700' }}>Taksitli Planlar</Text>
          {installmentPlans.map((plan) => {
            const planInstallments = allInstallments.filter((i) => i.plan_id === plan.id)
            return (
              <Card key={plan.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.foreground, fontWeight: '700' }}>
                    {currencyCompact(Number(plan.total_amount))} / {plan.installment_count} taksit
                  </Text>
                </View>
                {planInstallments.map((installment) => (
                  <View key={installment.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
                      Taksit {installment.installment_no} — {format(new Date(installment.due_date), 'd MMM yyyy', { locale: trLocale })}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>
                        {currencyCompact(Number(installment.amount))}
                      </Text>
                      {installment.paid_payment_id ? (
                        <Badge variant="success">Tahsil Edildi</Badge>
                      ) : (
                        <Pressable onPress={() => setCollectInstallment(installment)} hitSlop={6}>
                          <Badge variant="outline">Tahsil Et</Badge>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
            )
          })}
        </View>
      )}

      <AddPaymentModal visible={showAddPayment} customerId={customerId} onClose={() => setShowAddPayment(false)} />
      <InstallmentPlanModal
        visible={showInstallmentPlan}
        customerId={customerId}
        customerName={customerName}
        onClose={() => setShowInstallmentPlan(false)}
      />
      <InvoiceModal payment={invoicePayment} onClose={() => setInvoicePayment(null)} />
      <CollectInstallmentModal installment={collectInstallment} onClose={() => setCollectInstallment(null)} />
    </View>
  )
}

function AddPaymentModal({ visible, customerId, onClose }: { visible: boolean; customerId: string; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreatePayment()
  const [amount, setAmount] = React.useState('')
  const [method, setMethod] = React.useState<PaymentMethod>('nakit')
  const [description, setDescription] = React.useState('')

  React.useEffect(() => {
    if (visible) {
      setAmount('')
      setMethod('nakit')
      setDescription('')
    }
  }, [visible])

  async function onSave() {
    const value = Number(amount)
    if (!value || value <= 0) return
    await createMutation.mutateAsync({
      customer_id: customerId,
      amount: value,
      payment_method: method,
      description: description.trim() || null,
      paid_at: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <AppModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
        <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.spacing(5), gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Tahsilat</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={22} color={theme.colors.foreground} />
            </Pressable>
          </View>
          <TextField label="Tutar (₺) *" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '600' }}>Ödeme Yöntemi</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {PAYMENT_METHODS.map((m) => (
                <Pressable key={m} onPress={() => setMethod(m)} hitSlop={4}>
                  <Badge variant={method === m ? 'default' : 'outline'}>{tr.paymentMethod[m] ?? m}</Badge>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <TextField label="Açıklama (opsiyonel)" value={description} onChangeText={setDescription} />
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!Number(amount)}>
            Kaydet
          </Button>
        </View>
      </View>
    </AppModal>
  )
}

/** Masaüstündeki InvoiceDialog'un mobil karşılığı — fatura numarası +
 * dosyası (invoices private bucket, imzalı URL ile görüntüleme). RN'de
 * tarayıcı file input yok; AttachmentsSection'daki aynı kamera/galeri
 * (base64) deseni kullanılıyor. */
function InvoiceModal({ payment, onClose }: { payment: PaymentWithCustomer | null; onClose: () => void }) {
  const theme = useTheme()
  const saveMutation = useSaveInvoice()
  const urlMutation = useInvoiceFileUrl()
  const [invoiceNumber, setInvoiceNumber] = React.useState('')
  const [pickedBase64, setPickedBase64] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (payment) {
      setInvoiceNumber(payment.invoice_number ?? '')
      setPickedBase64(null)
    }
  }, [payment])

  async function pick(source: 'camera' | 'library') {
    const permission =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'İzin gerekli', text2: 'Kamera/galeri izni verilmedi' })
      return
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 })
    if (result.canceled || !result.assets[0]?.base64) return
    setPickedBase64(result.assets[0].base64)
  }

  async function onView() {
    if (!payment?.invoice_file_path) return
    const url = await urlMutation.mutateAsync(payment.invoice_file_path)
    Linking.openURL(url)
  }

  async function onSave() {
    if (!payment) return
    await saveMutation.mutateAsync({
      paymentId: payment.id,
      invoiceNumber: invoiceNumber || null,
      base64: pickedBase64,
      ext: 'jpg',
      contentType: 'image/jpeg',
    })
    onClose()
  }

  return (
    <AppModal visible={!!payment} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
        <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.spacing(5), gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Fatura Bilgisi</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={22} color={theme.colors.foreground} />
            </Pressable>
          </View>
          <TextField label="Fatura Numarası" value={invoiceNumber} onChangeText={setInvoiceNumber} placeholder="ABC2026000000123" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button variant="outline" size="sm" style={{ flex: 1 }} onPress={() => pick('camera')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Camera size={15} color={theme.colors.foreground} />
                <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>Tara</Text>
              </View>
            </Button>
            <Button variant="outline" size="sm" style={{ flex: 1 }} onPress={() => pick('library')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <FileText size={15} color={theme.colors.foreground} />
                <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>Galeriden Ekle</Text>
              </View>
            </Button>
          </View>
          {pickedBase64 && <Text style={{ color: theme.colors.success, fontSize: theme.fontSizes.sm }}>Yeni fatura görseli seçildi, kaydedince yüklenecek.</Text>}
          {payment?.invoice_file_path && !pickedBase64 && (
            <Button variant="outline" size="sm" onPress={onView} loading={urlMutation.isPending}>
              Yüklü Faturayı Görüntüle
            </Button>
          )}
          <Button onPress={onSave} loading={saveMutation.isPending}>
            Kaydet
          </Button>
        </View>
      </View>
    </AppModal>
  )
}

/** Masaüstündeki InstallmentPlanForm'un mobil karşılığı — bu doktor
 * bağlamında açıldığı için customer_id sabit, doktor seçici yok. */
function InstallmentPlanModal({
  visible,
  customerId,
  customerName,
  onClose,
}: {
  visible: boolean
  customerId: string
  customerName: string
  onClose: () => void
}) {
  const theme = useTheme()
  const createMutation = useCreateInstallmentPlan()
  const [totalAmount, setTotalAmount] = React.useState('')
  const [installmentCount, setInstallmentCount] = React.useState('3')
  const [intervalDays, setIntervalDays] = React.useState('30')
  const [firstDueDate, setFirstDueDate] = React.useState(format(new Date(), 'yyyy-MM-dd'))
  const [lateFeeRate, setLateFeeRate] = React.useState('')
  const [description, setDescription] = React.useState('')

  React.useEffect(() => {
    if (visible) {
      setTotalAmount('')
      setInstallmentCount('3')
      setIntervalDays('30')
      setFirstDueDate(format(new Date(), 'yyyy-MM-dd'))
      setLateFeeRate('')
      setDescription('')
    }
  }, [visible])

  async function onSave() {
    const total = Number(totalAmount)
    const count = Number(installmentCount)
    const interval = Number(intervalDays)
    if (!total || total <= 0 || !count || count < 2 || !interval || interval <= 0 || !firstDueDate) return
    await createMutation.mutateAsync({
      customer_id: customerId,
      total_amount: total,
      installment_count: count,
      interval_days: interval,
      first_due_date: firstDueDate,
      late_fee_rate: Number(lateFeeRate) || 0,
      description: description.trim() || null,
    })
    onClose()
  }

  return (
    <AppModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
        <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.spacing(5), gap: 12, maxHeight: '88%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              Taksitli Plan — {customerName}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={22} color={theme.colors.foreground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            <TextField label="Toplam Tutar (₺) *" value={totalAmount} onChangeText={setTotalAmount} keyboardType="numeric" placeholder="0" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextField
                label="Taksit Sayısı *"
                value={installmentCount}
                onChangeText={setInstallmentCount}
                keyboardType="numeric"
                containerStyle={{ flex: 1 }}
              />
              <TextField
                label="Aralık (gün)"
                value={intervalDays}
                onChangeText={setIntervalDays}
                keyboardType="numeric"
                containerStyle={{ flex: 1 }}
              />
            </View>
            <TextField label="İlk Vade Tarihi *" value={firstDueDate} onChangeText={setFirstDueDate} placeholder="YYYY-MM-DD" />
            <TextField label="Gecikme Faizi (%, opsiyonel)" value={lateFeeRate} onChangeText={setLateFeeRate} keyboardType="numeric" />
            <TextField label="Açıklama (opsiyonel)" value={description} onChangeText={setDescription} />
            <Button onPress={onSave} loading={createMutation.isPending} disabled={!Number(totalAmount) || Number(installmentCount) < 2}>
              Planı Oluştur
            </Button>
          </ScrollView>
        </View>
      </View>
    </AppModal>
  )
}

/** Masaüstündeki CollectInstallmentDialog'un mobil karşılığı — taksit
 * tutarında yeni bir payments kaydı oluşturup taksidi paid_payment_id ile
 * ona bağlar. */
function CollectInstallmentModal({ installment, onClose }: { installment: InstallmentWithPlan | null; onClose: () => void }) {
  const theme = useTheme()
  const [method, setMethod] = React.useState<PaymentMethod>('nakit')
  const [submitting, setSubmitting] = React.useState(false)
  const markPaidMutation = useMarkInstallmentPaid()
  const plan = installment?.payment_installment_plans

  React.useEffect(() => {
    if (installment) setMethod('nakit')
  }, [installment])

  async function onCollect() {
    if (!installment || !plan) return
    setSubmitting(true)
    try {
      const payment = await createPayment({
        customer_id: plan.customer_id,
        amount: Number(installment.amount),
        payment_method: method,
        description: `Taksit ${installment.installment_no} tahsilatı`,
        paid_at: new Date().toISOString(),
      })
      await markPaidMutation.mutateAsync({ installmentId: installment.id, paymentId: payment.id })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppModal visible={!!installment} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
        <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.spacing(5), gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>
              Taksit {installment?.installment_no} Tahsilatı
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={22} color={theme.colors.foreground} />
            </Pressable>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '600' }}>Ödeme Yöntemi</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {PAYMENT_METHODS.map((m) => (
                <Pressable key={m} onPress={() => setMethod(m)} hitSlop={4}>
                  <Badge variant={method === m ? 'default' : 'outline'}>{tr.paymentMethod[m] ?? m}</Badge>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Button onPress={onCollect} loading={submitting}>
            Tahsil Et
          </Button>
        </View>
      </View>
    </AppModal>
  )
}

/**
 * "Müşteri Belge Yönetimi" — masaüstündeki attachments tablosu + documents
 * bucket'ı (private, zaten var, şema değişikliği yok) mobile taşındı.
 * "Tara" kamera ile fotoğraf çeker (gerçek çok sayfalı PDF taraması değil —
 * expo'da ek bir tarayıcı kütüphanesi olmadan yapılabilecek gerçekçi
 * karşılığı), "Galeri" var olan bir görseli/PDF'i seçer. Onay/durum akışı
 * şemada yok, bu yüzden eklenmedi — sadece tarama/yükleme/görüntüleme/arşiv.
 */
function AttachmentsSection({ customerId }: { customerId: string }) {
  const theme = useTheme()
  const { data: attachments = [], isLoading } = useAttachments('customer', customerId)
  const uploadMutation = useUploadAttachment('customer', customerId)
  const urlMutation = useAttachmentUrl()
  const deleteMutation = useDeleteAttachment('customer', customerId)

  async function pick(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'İzin gerekli', text2: 'Kamera/galeri izni verilmedi' })
      return
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 })
    if (result.canceled || !result.assets[0]?.base64) return
    const fileName = `belge-${format(new Date(), 'yyyyMMdd-HHmmss')}.jpg`
    await uploadMutation.mutateAsync({ fileName, base64: result.assets[0].base64, contentType: 'image/jpeg' })
  }

  async function onView(path: string) {
    const url = await urlMutation.mutateAsync(path)
    Linking.openURL(url)
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button variant="outline" size="sm" style={{ flex: 1 }} onPress={() => pick('camera')} loading={uploadMutation.isPending}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Camera size={15} color={theme.colors.foreground} />
            <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>Tara</Text>
          </View>
        </Button>
        <Button variant="outline" size="sm" style={{ flex: 1 }} onPress={() => pick('library')} loading={uploadMutation.isPending}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <FileText size={15} color={theme.colors.foreground} />
            <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>Galeriden Ekle</Text>
          </View>
        </Button>
      </View>

      {isLoading && <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>}
      {!isLoading && attachments.length === 0 && (
        <Text style={{ color: theme.colors.mutedForeground }}>Bu doktor için henüz belge yok</Text>
      )}
      {attachments.map((a) => (
        <ListItemCard
          key={a.id}
          icon={FileText}
          title={a.file_name}
          subtitle={format(new Date(a.created_at), 'd MMM yyyy HH:mm', { locale: trLocale })}
          onPress={() => onView(a.file_path)}
          right={
            <Pressable onPress={() => deleteMutation.mutate({ id: a.id, filePath: a.file_path })} hitSlop={8}>
              <Trash2 size={16} color={theme.colors.destructive} />
            </Pressable>
          }
        />
      ))}
    </View>
  )
}

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const theme = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>{label}</Text>
      <Text style={{ color: valueColor ?? theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '600' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}
