import * as React from 'react'
import { Pressable, RefreshControl, Text, View } from 'react-native'
import { AppModal } from '@/components/ui/AppModal'
import { format, isPast, isToday, differenceInMinutes } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, Stethoscope, Calendar, LogIn, LogOut, X, Package } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useVisits, useCreateVisit, useCheckInVisit, useCheckOutVisit, useUpdateVisitDetails } from '@/features/doctorVisits/hooks'
import { useStockMovementsForCustomer } from '@/features/stock/hooks'
import type { MoreStackParamList } from '@/navigation/types'
import type { DoctorVisit } from '@shared/types/database'

type Props = NativeStackScreenProps<MoreStackParamList, 'DoctorVisits'>

export function DoctorVisitsScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const [detailVisit, setDetailVisit] = React.useState<DoctorVisit | null>(null)
  const { data: visits = [], isLoading } = useVisits()
  const checkInMutation = useCheckInVisit()
  const checkOutMutation = useCheckOutVisit()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['doctor_visits'] })
    setRefreshing(false)
  }

  const activeCount = visits.filter(v => v.check_in_at && !v.check_out_at).length

  return (
    <Screen
      scroll
      style={{ gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <ScreenHeader
        title="Doktor Ziyaretleri"
        subtitle={`${visits.length} kayıt${activeCount > 0 ? ` · ${activeCount} aktif` : ''}`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      {/* Kullanıcı isteğiyle (2026-08-17) FlatList yerine düz View + .map() —
          Screen zaten tek bir dış ScrollView, içine ikinci bir FlatList
          koymak kaydırmayı kesiyordu. */}
      {isLoading && visits.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : visits.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {visits.map((item) => {
            const overdue = item.next_visit_date != null && isPast(new Date(item.next_visit_date)) && !isToday(new Date(item.next_visit_date))
            const isActive = !!item.check_in_at && !item.check_out_at
            const isCompleted = !!item.check_in_at && !!item.check_out_at
            const duration = isCompleted && item.check_in_at && item.check_out_at
              ? differenceInMinutes(new Date(item.check_out_at), new Date(item.check_in_at))
              : null
            return (
              <ListItemCard
                key={item.id}
                icon={Stethoscope}
                iconColor={isActive ? theme.colors.success : isCompleted ? theme.colors.mutedForeground : theme.colors.primary}
                title={item.doctor_name}
                subtitle={[
                  format(new Date(item.visit_date), 'd MMM yyyy', { locale: trLocale }),
                  item.discussed_products,
                  item.check_in_at ? `Check-in: ${format(new Date(item.check_in_at), 'HH:mm', { locale: trLocale })}` : null,
                  duration != null ? `${duration} dk` : null,
                ].filter(Boolean).join(' · ') || undefined}
                onPress={() => setDetailVisit(item)}
                right={
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {item.next_visit_date && (
                      <Badge variant={overdue ? 'destructive' : 'outline'}>
                        <Calendar size={10} color={overdue ? theme.colors.destructiveForeground : theme.colors.foreground} />{' '}
                        {format(new Date(item.next_visit_date), 'd MMM', { locale: trLocale })}
                      </Badge>
                    )}
                    {isActive && <Badge variant="default">Aktif</Badge>}
                    {isCompleted && <Badge variant="secondary">Tamam</Badge>}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {!item.check_in_at && (
                        <Pressable onPress={() => checkInMutation.mutate({ id: item.id })} hitSlop={8}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.colors.success + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm }}>
                            <LogIn size={12} color={theme.colors.success} />
                            <Text style={{ color: theme.colors.success, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>Giriş</Text>
                          </View>
                        </Pressable>
                      )}
                      {isActive && (
                        <Pressable onPress={() => checkOutMutation.mutate({ id: item.id })} hitSlop={8}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.colors.destructive + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm }}>
                            <LogOut size={12} color={theme.colors.destructive} />
                            <Text style={{ color: theme.colors.destructive, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>Çıkış</Text>
                          </View>
                        </Pressable>
                      )}
                    </View>
                  </View>
                }
              />
            )
          })}
        </View>
      )}
      <AddVisitModal visible={showAdd} onClose={() => setShowAdd(false)} />
      <VisitDetailModal visit={detailVisit} onClose={() => setDetailVisit(null)} />
    </Screen>
  )
}

/**
 * Ziyaret satırına dokununca açılan detay/düzenleme modalı — "ne
 * konuşuldu, ne verildi, ne planlandı" hepsi burada: notlar/konuşulan
 * ürünler/sonraki takip düzenlenebilir (updateVisitDetails, check_out_at'e
 * dokunmaz), verilen numuneler (stock_movements, 'sample' tipi, aynı
 * customer_id + gün) salt okunur listelenir.
 */
function VisitDetailModal({ visit, onClose }: { visit: DoctorVisit | null; onClose: () => void }) {
  const theme = useTheme()
  const updateDetails = useUpdateVisitDetails()
  const [notes, setNotes] = React.useState('')
  const [discussedProducts, setDiscussedProducts] = React.useState('')
  const [nextVisitDate, setNextVisitDate] = React.useState('')

  React.useEffect(() => {
    if (visit) {
      setNotes(visit.notes ?? '')
      setDiscussedProducts(visit.discussed_products ?? '')
      setNextVisitDate(visit.next_visit_date ?? '')
    }
  }, [visit])

  const dayStart = visit ? `${visit.visit_date}T00:00:00` : ''
  const dayEnd = visit ? `${visit.visit_date}T23:59:59` : ''
  const { data: samples = [] } = useStockMovementsForCustomer(visit?.customer_id ?? undefined, dayStart, dayEnd)

  async function onSave() {
    if (!visit) return
    await updateDetails.mutateAsync({
      id: visit.id,
      patch: {
        notes: notes.trim() || null,
        discussed_products: discussedProducts.trim() || null,
        next_visit_date: nextVisitDate || null,
      },
    })
    onClose()
  }

  return (
    <AppModal visible={!!visit} animationType="slide" onRequestClose={onClose}>
      <Screen scroll>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }} numberOfLines={1}>
            {visit?.doctor_name}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          {visit && (
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
              {format(new Date(visit.visit_date), 'd MMMM yyyy', { locale: trLocale })}
            </Text>
          )}
          <TextField
            label="Ziyaret Sonucu (Konuşulan / Verilen Ürünler)"
            value={discussedProducts}
            onChangeText={setDiscussedProducts}
            placeholder="Örn: Fillicia 200"
            multiline
          />
          <TextField label="Notlar" value={notes} onChangeText={setNotes} placeholder="Ne konuşuldu..." multiline />
          <TextField
            label="Sonraki Ziyaret (Planlanan)"
            value={nextVisitDate}
            onChangeText={setNextVisitDate}
            placeholder="YYYY-MM-DD"
          />
          <Button onPress={onSave} loading={updateDetails.isPending}>
            Kaydet
          </Button>

          {visit?.customer_id && samples.length > 0 && (
            <View style={{ gap: 6, marginTop: 8 }}>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>
                O Gün Verilen Numuneler
              </Text>
              {samples.map((s) => (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Package size={13} color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm }}>
                    {s.product_name} × {s.quantity}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Screen>
    </AppModal>
  )
}

function AddVisitModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateVisit()
  const [doctorName, setDoctorName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [nextDate, setNextDate] = React.useState('')

  async function onSave() {
    if (!doctorName.trim()) return
    await createMutation.mutateAsync({
      doctor_name: doctorName.trim(),
      phone: phone.trim() || null,
      notes: notes.trim() || null,
      visit_date: new Date().toISOString(),
      next_visit_date: nextDate || null,
    })
    setDoctorName(''); setPhone(''); setNotes(''); setNextDate('')
    onClose()
  }

  return (
    <AppModal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Ziyaret</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <TextField label="Doktor Adı *" value={doctorName} onChangeText={setDoctorName} placeholder="Dr. Ahmet Yılmaz" />
          <TextField label="Telefon" value={phone} onChangeText={setPhone} placeholder="05XX..." keyboardType="phone-pad" />
          <TextField label="Notlar" value={notes} onChangeText={setNotes} placeholder="Görüşülen konular..." multiline />
          <TextField label="Sonraki Ziyaret Tarihi" value={nextDate} onChangeText={setNextDate} placeholder="YYYY-MM-DD" />
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!doctorName.trim()}>
            Kaydet
          </Button>
        </View>
      </Screen>
    </AppModal>
  )
}
