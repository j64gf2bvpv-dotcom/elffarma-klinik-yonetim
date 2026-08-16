import * as React from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { AppModal } from '@/components/ui/AppModal'
import { Plus, UserRound, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useParticipants, useCreateParticipant, useUpdateAttendanceStatus } from '@/features/congresses/hooks'
import type { AttendanceStatus } from '@shared/types/database'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'CongressDetail'>

const attendanceLabels: Record<AttendanceStatus, string> = {
  registered: 'Davetli',
  attended: 'Katıldı',
  no_show: 'Gelmedi',
}

const attendanceVariants: Record<AttendanceStatus, 'outline' | 'success' | 'destructive'> = {
  registered: 'outline',
  attended: 'success',
  no_show: 'destructive',
}

/** Master talimat §21'deki katılımcı listesi + yoklama (attendance_status)
 * takibi. Yoklama durumu satırdaki rozete dokununca sırayla döner
 * (Davetli→Katıldı→Gelmedi→Davetli). */
export function CongressDetailScreen({ route }: Props) {
  const { congressId, congressName } = route.params
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const { data: participants = [], isLoading } = useParticipants(congressId)
  const updateAttendance = useUpdateAttendanceStatus()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['congress_participants', congressId] })
    setRefreshing(false)
  }

  function cycleAttendance(id: string, current: AttendanceStatus) {
    const next: AttendanceStatus = current === 'registered' ? 'attended' : current === 'attended' ? 'no_show' : 'registered'
    updateAttendance.mutate({ id, status: next })
  }

  const attendedCount = participants.filter((p) => p.attendance_status === 'attended').length

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title={congressName}
        subtitle={`${participants.length} katılımcı · ${attendedCount} katıldı`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      {isLoading && participants.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={participants}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Katılımcı yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <ListItemCard
              icon={UserRound}
              iconColor={item.attendance_status === 'attended' ? theme.colors.success : theme.colors.mutedForeground}
              title={item.doctor_name}
              subtitle={item.notes ?? undefined}
              right={
                <Pressable onPress={() => cycleAttendance(item.id, item.attendance_status)} hitSlop={8}>
                  <Badge variant={attendanceVariants[item.attendance_status]}>{attendanceLabels[item.attendance_status]}</Badge>
                </Pressable>
              }
            />
          )}
        />
      )}
      <AddParticipantModal congressId={congressId} visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function AddParticipantModal({
  congressId,
  visible,
  onClose,
}: {
  congressId: string
  visible: boolean
  onClose: () => void
}) {
  const theme = useTheme()
  const createMutation = useCreateParticipant()
  const [doctorName, setDoctorName] = React.useState('')
  const [notes, setNotes] = React.useState('')

  async function onSave() {
    if (!doctorName.trim()) return
    await createMutation.mutateAsync({ congress_id: congressId, doctor_name: doctorName.trim(), notes: notes.trim() || null })
    setDoctorName(''); setNotes('')
    onClose()
  }

  return (
    <AppModal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Katılımcı Ekle</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <TextField label="Doktor Adı *" value={doctorName} onChangeText={setDoctorName} placeholder="Dr. Ahmet Yılmaz" />
          <TextField label="Not" value={notes} onChangeText={setNotes} placeholder="Detay..." multiline />
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!doctorName.trim()}>
            Kaydet
          </Button>
        </View>
      </Screen>
    </AppModal>
  )
}
