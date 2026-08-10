import * as React from 'react'
import { FlatList, Linking, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { Building2, Phone, Plus, Star, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { PendingSyncBadge } from '@/components/PendingSyncBadge'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useCustomers, useCreateCustomer } from '@/features/customers/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useSales } from '@/features/sales/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useRegions, regionLabel } from '@/features/regions/hooks'
import { computeCariLedger } from '@shared/businessLogic/cariLedger'
import type { DoctorsStackParamList } from '@/navigation/types'
import type { Customer } from '@shared/types/database'

type Props = NativeStackScreenProps<DoctorsStackParamList, 'DoctorsList'>

type DoctorFilter = 'all' | 'mine' | 'active' | 'potential'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

/**
 * Master talimat mockup'ındaki "Doktor Listesi" ekranı — arama, durum
 * filtreleri (Tümü/Aktif/Potansiyel), her satırda ad+uzmanlık/klinik+bakiye
 * rozeti. Bakiye computeCariLedger'dan (shared/), "aktif" doktorun
 * customers.is_active alanına, "potansiyel" ise henüz hiç satış/tahsilatı
 * olmayan doktorlara karşılık gelir (ayrı bir "status" sütunu şemada yok).
 */
export function DoctorsListScreen({ navigation }: Props) {
  const theme = useTheme()
  const { staff } = useAuth()
  const [search, setSearch] = React.useState('')
  const [filter, setFilter] = React.useState<DoctorFilter>('all')
  const [regionId, setRegionId] = React.useState<string | null>(null)
  const [showAdd, setShowAdd] = React.useState(false)
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)

  const { data: customers = [], isLoading } = useCustomers(search)
  const { data: allPayments = [] } = usePayments({})
  const { data: allSales = [] } = useSales()
  const { data: allInvoices = [] } = useInvoices()
  const { data: salesReps = [] } = useSalesReps()
  const { data: regions = [] } = useRegions()

  const ledger = React.useMemo(
    () => computeCariLedger(allPayments, allSales, allInvoices),
    [allPayments, allSales, allInvoices],
  )

  const hasActivity = React.useMemo(() => {
    const set = new Set<string>()
    for (const s of allSales) set.add(s.customer_id)
    for (const p of allPayments) set.add(p.customer_id)
    return set
  }, [allSales, allPayments])

  // Master talimat §5'teki "satış temsilcisi kendisine atanmış doktorları
  // görür" kuralının veri-kısıtlamayan mobil karşılığı — RLS/erişim kontrolü
  // değil, sadece varsayılan görünüm filtresi (bkz. plan: staff↔sales_reps
  // arasında güvenilir FK yok, sadece isim eşleşmesi; hiçbir doktoru
  // gizlemiyoruz, sadece "Benim Doktorlarım" sekmesinde önceliklendiriyoruz).
  const myRepId = React.useMemo(
    () => salesReps.find((r) => r.name.trim().toLowerCase() === (staff?.full_name ?? '').trim().toLowerCase())?.id,
    [salesReps, staff?.full_name],
  )

  // Doktorları bölgesel ayırma — mevcut regions tablosu (masaüstüyle aynı,
  // hiyerarşik parent_region_id) üzerinden. Sadece en az bir doktoru olan
  // bölgeler chip olarak gösteriliyor, bölgesi olmayan doktorlar "Tümü"nde
  // görünmeye devam ediyor (gizlenmiyor).
  const regionsById = React.useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions])
  const usedRegions = React.useMemo(() => {
    const used = new Set(customers.map((c) => c.region_id).filter((id): id is string => id != null))
    return regions
      .filter((r) => used.has(r.id))
      .sort((a, b) => regionLabel(a, regionsById).localeCompare(regionLabel(b, regionsById), 'tr'))
  }, [regions, customers, regionsById])

  const rows = React.useMemo(
    () =>
      customers
        .map((c) => {
          const entry = ledger.get(c.id) ?? { debit: 0, credit: 0 }
          return { customer: c, balance: entry.debit - entry.credit, isPotential: !hasActivity.has(c.id) }
        })
        .filter((r) => {
          if (regionId != null && r.customer.region_id !== regionId) return false
          if (filter === 'mine') return myRepId != null && r.customer.sales_rep_id === myRepId
          if (filter === 'active') return r.customer.is_active && !r.isPotential
          if (filter === 'potential') return r.isPotential
          return true
        })
        .sort((a, b) => a.customer.full_name.localeCompare(b.customer.full_name, 'tr')),
    [customers, ledger, hasActivity, filter, myRepId, regionId],
  )

  const myCount = myRepId != null ? customers.filter((c) => c.sales_rep_id === myRepId).length : 0
  const activeCount = customers.filter((c) => c.is_active && hasActivity.has(c.id)).length
  const potentialCount = customers.filter((c) => !hasActivity.has(c.id)).length

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Doktorlar"
        subtitle={`${customers.length} kayıt`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      <PendingSyncBadge />
      <TextField
        placeholder="Ara (ad, telefon)..."
        value={search}
        onChangeText={setSearch}
        containerStyle={{ marginBottom: 2 }}
      />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(
          [
            ['all', `Tümü (${customers.length})`],
            ...(myRepId != null ? ([['mine', `Benim Doktorlarım (${myCount})`]] as [DoctorFilter, string][]) : []),
            ['active', `Aktif (${activeCount})`],
            ['potential', `Potansiyel (${potentialCount})`],
          ] as [DoctorFilter, string][]
        ).map(([key, label]) => (
          <Pressable key={key} onPress={() => setFilter(key)} hitSlop={4}>
            <Badge variant={filter === key ? 'default' : 'outline'}>{label}</Badge>
          </Pressable>
        ))}
      </View>
      {usedRegions.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          <Pressable onPress={() => setRegionId(null)} hitSlop={4}>
            <Badge variant={regionId == null ? 'default' : 'outline'}>Tüm Bölgeler</Badge>
          </Pressable>
          {usedRegions.map((region) => (
            <Pressable key={region.id} onPress={() => setRegionId(region.id)} hitSlop={4}>
              <Badge variant={regionId === region.id ? 'default' : 'outline'}>{regionLabel(region, regionsById)}</Badge>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {isLoading && rows.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.customer.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <DoctorRow
              customer={item.customer}
              balance={item.balance}
              isPotential={item.isPotential}
              onPress={() =>
                navigation.navigate('DoctorDetail', { customerId: item.customer.id, customerName: item.customer.full_name })
              }
            />
          )}
        />
      )}
      <AddDoctorModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function QuickActionButton({ icon: Icon, onPress }: { icon: typeof Phone; onPress: () => void }) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Icon size={13} color={theme.colors.foreground} />
    </Pressable>
  )
}

function DoctorRow({
  customer,
  balance,
  isPotential,
  onPress,
}: {
  customer: Customer
  balance: number
  isPotential: boolean
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <ListItemCard
      icon={Building2}
      iconColor={!customer.is_active ? theme.colors.mutedForeground : isPotential ? theme.colors.warning : theme.colors.success}
      title={customer.full_name}
      subtitle={[customer.specialty, customer.hospital_name, customer.province].filter(Boolean).join(' · ') || undefined}
      onPress={onPress}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {customer.is_vip && <Star size={14} color={theme.colors.warning} fill={theme.colors.warning} />}
          <QuickActionButton icon={Phone} onPress={() => Linking.openURL(`tel:${customer.phone}`)} />
          {!isPotential && <Badge variant={balance > 0 ? 'destructive' : 'secondary'}>{currency(balance)}</Badge>}
          {isPotential && <Badge variant="outline">Potansiyel</Badge>}
        </View>
      }
    />
  )
}

function AddDoctorModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateCustomer()
  const [fullName, setFullName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [hospital, setHospital] = React.useState('')

  async function onSave() {
    if (!fullName.trim() || !phone.trim()) return
    await createMutation.mutateAsync({
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      hospital_name: hospital.trim() || null,
    })
    setFullName(''); setPhone(''); setEmail(''); setHospital('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Doktor</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <TextField label="Ad Soyad *" value={fullName} onChangeText={setFullName} placeholder="Dr. Ahmet Yılmaz" />
          <TextField label="Telefon *" value={phone} onChangeText={setPhone} placeholder="05XX XXX XX XX" keyboardType="phone-pad" />
          <TextField label="E-posta" value={email} onChangeText={setEmail} placeholder="email@örnek.com" keyboardType="email-address" />
          <TextField label="Hastane/Klinik" value={hospital} onChangeText={setHospital} placeholder="Hastane adı" />
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!fullName.trim() || !phone.trim()}>
            Kaydet
          </Button>
        </View>
      </Screen>
    </Modal>
  )
}
