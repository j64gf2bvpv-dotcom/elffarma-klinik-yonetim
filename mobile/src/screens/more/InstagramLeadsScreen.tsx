import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, AtSign, Trash2, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useInstagramLeads, useCreateInstagramLead, useDeleteInstagramLead } from '@/features/instagramLeads/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'InstagramLeads'>

export function InstagramLeadsScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const { data: leads = [], isLoading } = useInstagramLeads()
  const deleteMutation = useDeleteInstagramLead()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['instagram_leads'] })
    setRefreshing(false)
  }

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Instagram Doktor Listesi"
        subtitle={`${leads.length} kayıt`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      {isLoading && leads.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <ListItemCard
              icon={AtSign}
              iconColor={theme.colors.primary}
              title={item.full_name}
              subtitle={[
                item.instagram_username ? `@${item.instagram_username}` : null,
                item.phone,
                format(new Date(item.created_at), 'd MMM yyyy', { locale: trLocale }),
              ].filter(Boolean).join(' · ') || undefined}
              right={
                <Pressable onPress={() => deleteMutation.mutate(item.id)} hitSlop={8}>
                  <Trash2 size={16} color={theme.colors.mutedForeground} />
                </Pressable>
              }
            />
          )}
        />
      )}
      <AddLeadModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function AddLeadModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateInstagramLead()
  const [fullName, setFullName] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [notes, setNotes] = React.useState('')

  async function onSave() {
    if (!fullName.trim()) return
    await createMutation.mutateAsync({
      full_name: fullName.trim(),
      instagram_username: username.trim().replace('@', '') || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
    })
    setFullName(''); setUsername(''); setPhone(''); setEmail(''); setNotes('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Lead</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <TextField label="Ad Soyad *" value={fullName} onChangeText={setFullName} placeholder="Dr. Ahmet Yılmaz" />
          <TextField label="Instagram" value={username} onChangeText={setUsername} placeholder="@kullaniciadi" autoCapitalize="none" />
          <TextField label="Telefon" value={phone} onChangeText={setPhone} placeholder="05XX..." keyboardType="phone-pad" />
          <TextField label="E-posta" value={email} onChangeText={setEmail} placeholder="email@örnek.com" keyboardType="email-address" />
          <TextField label="Notlar" value={notes} onChangeText={setNotes} placeholder="Not..." multiline />
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!fullName.trim()}>
            Kaydet
          </Button>
        </View>
      </Screen>
    </Modal>
  )
}
