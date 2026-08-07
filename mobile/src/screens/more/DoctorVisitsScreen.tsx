import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { format, isPast, isToday } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, Stethoscope, Calendar, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useVisits, useCreateVisit } from '@/features/doctorVisits/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'DoctorVisits'>

export function DoctorVisitsScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const { data: visits = [], isLoading } = useVisits()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['doctor_visits'] })
    setRefreshing(false)
  }

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Doktor Ziyaretleri"
        subtitle={`${visits.length} kayıt`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      {isLoading && visits.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(v) => v.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const overdue = item.next_visit_date != null && isPast(new Date(item.next_visit_date)) && !isToday(new Date(item.next_visit_date))
            return (
              <ListItemCard
                icon={Stethoscope}
                title={item.doctor_name}
                subtitle={[
                  format(new Date(item.visit_date), 'd MMM yyyy', { locale: trLocale }),
                  item.discussed_products,
                ].filter(Boolean).join(' · ') || undefined}
                right={
                  item.next_visit_date ? (
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Badge variant={overdue ? 'destructive' : 'outline'}>
                        <Calendar size={10} color={overdue ? theme.colors.destructiveForeground : theme.colors.foreground} />{' '}
                        {format(new Date(item.next_visit_date), 'd MMM', { locale: trLocale })}
                      </Badge>
                    </View>
                  ) : undefined
                }
              />
            )
          }}
        />
      )}
      <AddVisitModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
    </Modal>
  )
}
