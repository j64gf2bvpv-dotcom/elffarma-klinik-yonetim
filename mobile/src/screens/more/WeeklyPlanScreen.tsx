import * as React from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { addWeeks, eachDayOfInterval, endOfWeek, format, isSameDay, startOfWeek, subWeeks } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { CalendarRange, ChevronLeft, ChevronRight, Plus, Stethoscope, Trash2, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { CustomerPickerModal } from '@/components/CustomerPickerModal'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useStaffList } from '@/features/staff/hooks'
import { useVisitPlans, useCreateVisitPlan, useUpdateVisitPlanStatus, useDeleteVisitPlan } from '@/features/visitPlans/hooks'
import type { MoreStackParamList } from '@/navigation/types'
import type { Customer, VisitPlanStatus } from '@shared/types/database'

type Props = NativeStackScreenProps<MoreStackParamList, 'WeeklyPlan'>

const statusLabels: Record<VisitPlanStatus, string> = {
  bekliyor: 'Bekliyor',
  tamamlandi: 'Tamamlandı',
  iptal: 'İptal',
}
const nextStatus: Record<VisitPlanStatus, VisitPlanStatus> = {
  bekliyor: 'tamamlandi',
  tamamlandi: 'iptal',
  iptal: 'bekliyor',
}

/**
 * "Haftalık Plan" — admin'in bu hafta hangi doktora hangi personelin
 * gitmesi gerektiğini atadığı, ileriye dönük planlama ekranı (Haftalık
 * Rapor'dan farklı — o geçmişe dönük gerçekleşen ziyaret/numune özetiydi).
 * Yazma sadece admin (RLS zorluyor, visit_plans_admin_write) — personel
 * sadece kendisine atanan planları görür.
 */
export function WeeklyPlanScreen(_: Props) {
  const theme = useTheme()
  const { staff } = useAuth()
  const isAdmin = staff?.role === 'admin'
  const { data: staffList = [] } = useStaffList()
  const [weekAnchor, setWeekAnchor] = React.useState(new Date())
  const [showAdd, setShowAdd] = React.useState(false)

  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

  const { data: plans = [] } = useVisitPlans(weekStartStr, weekEndStr)
  const updateStatus = useUpdateVisitPlanStatus()
  const deletePlan = useDeleteVisitPlan()

  const visiblePlans = React.useMemo(
    () => (isAdmin ? plans : plans.filter((p) => p.assigned_staff_id === staff?.id)),
    [plans, isAdmin, staff?.id],
  )

  return (
    <Screen scroll style={{ gap: 12 }}>
      <ScreenHeader
        title="Haftalık Plan"
        subtitle={isAdmin ? 'Bu hafta atanan doktor ziyaretleri' : 'Size atanan ziyaretler'}
        actions={
          isAdmin ? (
            <Button size="sm" onPress={() => setShowAdd(true)}>
              <Plus size={16} color={theme.colors.primaryForeground} />
            </Button>
          ) : undefined
        }
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setWeekAnchor((d) => subWeeks(d, 1))} hitSlop={10} style={{ padding: 6 }}>
          <ChevronLeft size={20} color={theme.colors.foreground} />
        </Pressable>
        <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.base }}>
          {format(weekStart, 'd MMM', { locale: trLocale })} – {format(weekEnd, 'd MMM yyyy', { locale: trLocale })}
        </Text>
        <Pressable onPress={() => setWeekAnchor((d) => addWeeks(d, 1))} hitSlop={10} style={{ padding: 6 }}>
          <ChevronRight size={20} color={theme.colors.foreground} />
        </Pressable>
      </View>

      {!isAdmin && !staff && null}
      {visiblePlans.length === 0 && (
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 30 }}>
          <CalendarRange size={36} color={theme.colors.mutedForeground} />
          <Text style={{ color: theme.colors.mutedForeground }}>
            {isAdmin ? 'Bu hafta için plan yok' : 'Bu hafta size atanan bir ziyaret yok'}
          </Text>
        </View>
      )}

      {days.map((day) => {
        const dayPlans = visiblePlans.filter((p) => isSameDay(new Date(p.planned_date), day))
        if (dayPlans.length === 0) return null
        return (
          <Card key={day.toISOString()} style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: theme.fontSizes.sm }}>
              {format(day, 'EEEE, d MMMM', { locale: trLocale })}
            </Text>
            {dayPlans.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Stethoscope size={14} color={theme.colors.foreground} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }} numberOfLines={1}>
                    {p.customer_name}
                  </Text>
                  {isAdmin && p.staff_name && (
                    <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>{p.staff_name}</Text>
                  )}
                  {p.note && (
                    <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }} numberOfLines={1}>
                      {p.note}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => isAdmin && updateStatus.mutate({ id: p.id, status: nextStatus[p.status] })}
                  disabled={!isAdmin}
                  hitSlop={4}
                >
                  <Badge variant={p.status === 'tamamlandi' ? 'success' : p.status === 'iptal' ? 'destructive' : 'outline'}>
                    {statusLabels[p.status]}
                  </Badge>
                </Pressable>
                {isAdmin && (
                  <Pressable onPress={() => deletePlan.mutate(p.id)} hitSlop={8}>
                    <Trash2 size={14} color={theme.colors.destructive} />
                  </Pressable>
                )}
              </View>
            ))}
          </Card>
        )
      })}

      {isAdmin && (
        <AddPlanModal
          visible={showAdd}
          onClose={() => setShowAdd(false)}
          staffList={staffList}
          defaultDate={format(new Date(), 'yyyy-MM-dd')}
        />
      )}
    </Screen>
  )
}

function AddPlanModal({
  visible,
  onClose,
  staffList,
  defaultDate,
}: {
  visible: boolean
  onClose: () => void
  staffList: { id: string; full_name: string }[]
  defaultDate: string
}) {
  const theme = useTheme()
  const createPlan = useCreateVisitPlan()
  const [customer, setCustomer] = React.useState<Customer | null>(null)
  const [customerPickerOpen, setCustomerPickerOpen] = React.useState(false)
  const [assignedStaffId, setAssignedStaffId] = React.useState<string | null>(null)
  const [plannedDate, setPlannedDate] = React.useState(defaultDate)
  const [note, setNote] = React.useState('')

  React.useEffect(() => {
    if (visible) {
      setCustomer(null)
      setAssignedStaffId(null)
      setPlannedDate(defaultDate)
      setNote('')
    }
  }, [visible, defaultDate])

  async function onSave() {
    if (!customer || !assignedStaffId || !plannedDate) return
    await createPlan.mutateAsync({
      customer_id: customer.id,
      assigned_staff_id: assignedStaffId,
      planned_date: plannedDate,
      note: note.trim() || null,
    })
    onClose()
  }

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing(5),
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Doktor Ata</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <X size={22} color={theme.colors.foreground} />
              </Pressable>
            </View>
            <Pressable onPress={() => setCustomerPickerOpen(true)}>
              <View
                style={{
                  height: 44,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: 12,
                  justifyContent: 'center',
                  backgroundColor: theme.colors.input,
                }}
              >
                <Text style={{ color: customer ? theme.colors.foreground : theme.colors.mutedForeground }} numberOfLines={1}>
                  {customer?.full_name ?? 'Doktor seç...'}
                </Text>
              </View>
            </Pressable>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>Personel</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {staffList.map((s) => (
                <Pressable key={s.id} onPress={() => setAssignedStaffId(s.id)} hitSlop={4}>
                  <Badge variant={assignedStaffId === s.id ? 'default' : 'outline'}>{s.full_name}</Badge>
                </Pressable>
              ))}
            </ScrollView>
            <TextField label="Tarih" value={plannedDate} onChangeText={setPlannedDate} placeholder="YYYY-MM-DD" />
            <TextField label="Not" value={note} onChangeText={setNote} placeholder="Detay..." />
            <Button onPress={onSave} loading={createPlan.isPending} disabled={!customer || !assignedStaffId}>
              Kaydet
            </Button>
          </View>
        </View>
      </Modal>
      <CustomerPickerModal
        visible={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(c) => {
          setCustomer(c)
          setCustomerPickerOpen(false)
        }}
      />
    </>
  )
}
