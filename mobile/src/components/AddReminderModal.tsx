import * as React from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { format } from 'date-fns'
import { X } from 'lucide-react-native'
import { Screen } from '@/components/ui/Screen'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/lib/ThemeContext'
import { useCreateReminder } from '@/features/reminders/hooks'

/**
 * RemindersScreen'den (Hatırlatmalar) ve AgendaScreen'den (Ajanda) ortak
 * kullanılan "Yeni Hatırlatma" formu — useCreateReminder zaten yerel bildirim
 * kuruyor (scheduleReminderNotification, hooks.ts), Dashboard'daki "Önemli
 * Duyurular" banner'ı da gecikmiş hatırlatmaları buradan sayıyor.
 */
export function AddReminderModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateReminder()
  const [title, setTitle] = React.useState('')
  const [note, setNote] = React.useState('')
  const [dueDate, setDueDate] = React.useState(format(new Date(), 'yyyy-MM-dd'))

  async function onSave() {
    if (!title.trim()) return
    await createMutation.mutateAsync({
      title: title.trim(),
      note: note.trim() || null,
      due_date: dueDate,
    })
    setTitle('')
    setNote('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Hatırlatma</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <TextField label="Başlık *" value={title} onChangeText={setTitle} placeholder="Hatırlatma başlığı" />
          <TextField label="Not" value={note} onChangeText={setNote} placeholder="Detay..." multiline />
          <TextField label="Tarih" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!title.trim()}>
            Kaydet
          </Button>
        </View>
      </Screen>
    </Modal>
  )
}
