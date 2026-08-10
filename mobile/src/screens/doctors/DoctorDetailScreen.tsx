import * as React from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { format } from 'date-fns'
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
  type LucideIcon,
} from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useCustomer } from '@/features/customers/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useSales } from '@/features/sales/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import { useCrmActivities } from '@/features/crm/hooks'
import { useOpportunities } from '@/features/opportunities/hooks'
import { useVisits } from '@/features/doctorVisits/hooks'
import { computeCariLedger, cariBalance } from '@shared/businessLogic/cariLedger'
import { tr } from '@shared/i18n/tr'
import type { DoctorsStackParamList } from '@/navigation/types'
import type { CrmOpportunityStage } from '@shared/types/database'

type Props = NativeStackScreenProps<DoctorsStackParamList, 'DoctorDetail'>

type TabKey = 'genel' | 'aktiviteler' | 'siparisler' | 'firsatlar' | 'ziyaretler'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'genel', label: 'Genel' },
  { key: 'aktiviteler', label: 'Aktiviteler' },
  { key: 'siparisler', label: 'Siparişler' },
  { key: 'firsatlar', label: 'Fırsatlar' },
  { key: 'ziyaretler', label: 'Ziyaretler' },
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
  React.useLayoutEffect(() => navigation.setOptions({ title: customerName }), [navigation, customerName])

  const { data: customer } = useCustomer(customerId)
  const { data: allPayments = [] } = usePayments({})
  const { data: allSales = [] } = useSales()
  const { data: allInvoices = [] } = useInvoices()
  const { data: allActivities = [] } = useCrmActivities()
  const { data: allOpportunities = [] } = useOpportunities('all')
  const { data: allVisits = [] } = useVisits()

  const sales = React.useMemo(() => allSales.filter((s) => s.customer_id === customerId), [allSales, customerId])
  const activities = React.useMemo(() => allActivities.filter((a) => a.customer_id === customerId), [allActivities, customerId])
  const opportunities = React.useMemo(() => allOpportunities.filter((o) => o.customer_id === customerId), [allOpportunities, customerId])
  const visits = React.useMemo(() => allVisits.filter((v) => v.customer_id === customerId), [allVisits, customerId])

  const ledger = React.useMemo(() => computeCariLedger(allPayments, allSales, allInvoices), [allPayments, allSales, allInvoices])
  const balance = cariBalance(ledger, customerId)
  const totalSales = React.useMemo(
    () => sales.filter((s) => s.type === 'sale').reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0),
    [sales],
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

      <View style={{ flexDirection: 'row', gap: 8 }}>
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
      </View>

      <View>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, fontWeight: '600', marginBottom: 8 }}>
          CRM Özeti
        </Text>
        <Card style={{ gap: 10 }}>
          <SummaryRow
            label="Son Görüşme"
            value={lastActivity ? format(new Date(lastActivity.occurred_at), 'd MMMM yyyy', { locale: trLocale }) : '—'}
          />
          <SummaryRow label="Son Sipariş" value={lastSale ? format(new Date(lastSale.sale_date), 'd MMMM yyyy', { locale: trLocale }) : '—'} />
          <SummaryRow label="Toplam Satış" value={currency(totalSales)} />
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
          {customer?.notes && (
            <Card>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, fontWeight: '600', marginBottom: 4 }}>
                Notlar
              </Text>
              <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm }}>{customer.notes}</Text>
            </Card>
          )}
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

      {tab === 'firsatlar' && (
        <View style={{ gap: 8 }}>
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
    <Button variant="outline" size="sm" onPress={onPress} disabled={disabled} style={{ flex: 1, flexDirection: 'column', height: 56, gap: 2 }}>
      <Icon size={16} color={disabled ? theme.colors.mutedForeground : theme.colors.primary} />
      <Text style={{ color: disabled ? theme.colors.mutedForeground : theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>
        {label}
      </Text>
    </Button>
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
