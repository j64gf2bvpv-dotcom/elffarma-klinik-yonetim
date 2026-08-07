import * as React from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native'
import { Sparkles, Send, User, Bot } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { useTheme } from '@/lib/ThemeContext'
import { chatWithText } from '@/features/ai/chat'
import { useAppSetting } from '@/features/appSettings/hooks'
import type { AISettings } from '@/features/ai/types'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'AIAnalysis'>

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `Sen Elffarma Paket Programı'nın yapay zeka asistanısın. Türk medikal estetik dağıtım sektörü için çalışıyorsun. Kullanıcının sorularını Türkçe yanıtla. Satış, stok, tahsilat, müşteri yönetimi konularında yardımcı ol.`

export function AIAnalysisScreen(_: Props) {
  const theme = useTheme()
  const [messages, setMessages] = React.useState<ChatMsg[]>([])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const { data: aiSettings } = useAppSetting<AISettings>('ai_settings')
  const flatListRef = React.useRef<FlatList<ChatMsg>>(null)

  const provider = aiSettings?.provider ?? 'ollama'
  const model = aiSettings?.model ?? 'qwen2.5:3b'

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      // Tek atışlık sohbet — mobil AI altyapısı streaming desteklemiyor
      const result = await chatWithText(`${SYSTEM_PROMPT}\n\nKullanıcı: ${text}`)
      const aiMsg: ChatMsg = { id: (Date.now() + 1).toString(), role: 'assistant', content: result }
      setMessages(prev => [...prev, aiMsg])
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Bilinmeyen hata'
      const aiMsg: ChatMsg = { id: (Date.now() + 1).toString(), role: 'assistant', content: `Hata: ${errMsg}` }
      setMessages(prev => [...prev, aiMsg])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen style={{ gap: 0 }}>
      <ScreenHeader
        title="Yapay Zeka Analiz"
        subtitle={`${provider} / ${model}`}
        actions={<Sparkles size={18} color={theme.colors.primary} />}
      />
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', gap: 8, paddingTop: 40 }}>
            <Sparkles size={40} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>AI Asistan</Text>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, textAlign: 'center' }}>
              Satış, stok, tahsilat veya müşteri analizleri hakkında soru sorun.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', gap: 8, alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            {item.role === 'assistant' && (
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.primary + '26', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={14} color={theme.colors.primary} />
              </View>
            )}
            <View
              style={{
                backgroundColor: item.role === 'user' ? theme.colors.primary : theme.colors.card,
                borderRadius: theme.radius.md,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderWidth: item.role === 'assistant' ? 1 : 0,
                borderColor: theme.colors.border,
              }}
            >
              <Text style={{ color: item.role === 'user' ? theme.colors.primaryForeground : theme.colors.foreground, fontSize: theme.fontSizes.sm }}>
                {item.content}
              </Text>
            </View>
            {item.role === 'user' && (
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.muted + '26', alignItems: 'center', justifyContent: 'center' }}>
                <User size={14} color={theme.colors.mutedForeground} />
              </View>
            )}
          </View>
        )}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', gap: 8, paddingTop: 8 }}>
          <TextField
            placeholder="Soru sorun..."
            value={input}
            onChangeText={setInput}
            style={{ flex: 1 }}
            onSubmitEditing={send}
          />
          <Pressable
            onPress={send}
            disabled={loading || !input.trim()}
            style={{
              width: 44,
              height: 44,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            <Send size={18} color={theme.colors.primaryForeground} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}
