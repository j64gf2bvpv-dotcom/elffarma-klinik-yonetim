import * as React from 'react'
import { FlatList, Linking, Pressable, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { format, isToday } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Paperclip, Send, X, FileText } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Toast from 'react-native-toast-message'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useTeamMessages, useSendMessage, useMessageAttachmentUrl } from '@/features/teamChat/hooks'
import type { StaffMessageWithSender } from '@/features/teamChat/api'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'TeamChat'>

/**
 * "Ekip Sohbeti" — personel içi yazışma + belge gönderme. Tek paylaşımlı
 * kanal (herkes herkesi görür, supabase/schema.sql "50. EKİP SOHBETİ") —
 * bire-bir DM yok, bilinçli MVP kapsamı. Gerçek zamanlı subscription yerine
 * 5sn'lik polling (useTeamMessages) kullanılıyor. Ek olarak sadece görsel
 * (fotoğraf/taranmış belge) desteklidir — expo-document-picker (rastgele
 * dosya türü) bu sürümde kurulu değil.
 */
export function TeamChatScreen(_: Props) {
  const theme = useTheme()
  const { staff } = useAuth()
  const { data: messages = [] } = useTeamMessages()
  const sendMutation = useSendMessage()
  const attachmentUrlMutation = useMessageAttachmentUrl()
  const [body, setBody] = React.useState('')
  const [pendingImage, setPendingImage] = React.useState<{ base64: string; fileName: string } | null>(null)
  const listRef = React.useRef<FlatList>(null)

  React.useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages.length])

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'İzin gerekli', text2: 'Galeri izni verilmedi' })
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6 })
    if (result.canceled || !result.assets[0]?.base64) return
    setPendingImage({ base64: result.assets[0].base64, fileName: `belge-${format(new Date(), 'yyyyMMdd-HHmmss')}.jpg` })
  }

  async function onSend() {
    if (!body.trim() && !pendingImage) return
    await sendMutation.mutateAsync({
      body: body.trim() || null,
      attachmentBase64: pendingImage?.base64 ?? null,
      attachmentFileName: pendingImage?.fileName ?? null,
    })
    setBody('')
    setPendingImage(null)
  }

  async function onOpenAttachment(path: string) {
    const url = await attachmentUrlMutation.mutateAsync(path)
    Linking.openURL(url)
  }

  return (
    <Screen style={{ gap: 10, flex: 1 }}>
      <ScreenHeader title="Ekip Sohbeti" subtitle="Tüm personel görür" />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
        ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground, textAlign: 'center', marginTop: 30 }}>Henüz mesaj yok</Text>}
        renderItem={({ item }) => (
          <MessageBubble message={item} isOwn={item.sender_id === staff?.id} onOpenAttachment={onOpenAttachment} />
        )}
      />

      {pendingImage && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.card, borderRadius: theme.radius.md, padding: 8, borderWidth: 1, borderColor: theme.colors.border }}>
          <FileText size={16} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xs, flex: 1 }} numberOfLines={1}>
            {pendingImage.fileName}
          </Text>
          <Pressable onPress={() => setPendingImage(null)} hitSlop={8}>
            <X size={16} color={theme.colors.destructive} />
          </Pressable>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={pickImage} hitSlop={8} style={{ padding: 8 }}>
          <Paperclip size={20} color={theme.colors.primary} />
        </Pressable>
        <TextField value={body} onChangeText={setBody} placeholder="Mesaj yaz..." style={{ flex: 1 }} multiline />
        <Pressable
          onPress={onSend}
          disabled={sendMutation.isPending || (!body.trim() && !pendingImage)}
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: sendMutation.isPending || (!body.trim() && !pendingImage) ? 0.5 : 1,
          }}
        >
          <Send size={16} color={theme.colors.primaryForeground} />
        </Pressable>
      </View>
    </Screen>
  )
}

function MessageBubble({
  message,
  isOwn,
  onOpenAttachment,
}: {
  message: StaffMessageWithSender
  isOwn: boolean
  onOpenAttachment: (path: string) => void
}) {
  const theme = useTheme()
  const time = new Date(message.created_at)
  return (
    <View style={{ alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
      {!isOwn && (
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, fontWeight: '600', marginBottom: 2, marginLeft: 4 }}>
          {message.sender_name}
        </Text>
      )}
      <View
        style={{
          maxWidth: '80%',
          backgroundColor: isOwn ? theme.colors.primary : theme.colors.card,
          borderWidth: isOwn ? 0 : 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          padding: 10,
          gap: 4,
        }}
      >
        {message.body && (
          <Text style={{ color: isOwn ? theme.colors.primaryForeground : theme.colors.foreground, fontSize: theme.fontSizes.sm }}>
            {message.body}
          </Text>
        )}
        {message.attachment_path && (
          <Pressable
            onPress={() => onOpenAttachment(message.attachment_path as string)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <FileText size={14} color={isOwn ? theme.colors.primaryForeground : theme.colors.primary} />
            <Text
              style={{
                color: isOwn ? theme.colors.primaryForeground : theme.colors.primary,
                fontSize: theme.fontSizes.xs,
                textDecorationLine: 'underline',
              }}
              numberOfLines={1}
            >
              {message.attachment_name ?? 'Belge'}
            </Text>
          </Pressable>
        )}
      </View>
      <Text style={{ color: theme.colors.mutedForeground, fontSize: 10, marginTop: 2, marginHorizontal: 4 }}>
        {isToday(time) ? format(time, 'HH:mm') : format(time, 'd MMM HH:mm', { locale: trLocale })}
      </Text>
    </View>
  )
}
