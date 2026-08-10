import * as React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { UserRound, Bot, Info, Shield, LogOut, ChevronRight, ClipboardList } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useStaffList, useUpdateStaff } from '@/features/staff/hooks'
import { useAppSetting } from '@/features/appSettings/hooks'
import type { AISettings } from '@/features/ai/types'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Settings'>

const roleLabels: Record<string, string> = {
  admin: 'Yönetici',
  staff: 'Personel',
}

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme()
  const { staff, signOut } = useAuth()
  const { data: staffList = [] } = useStaffList()
  const { data: aiSettings } = useAppSetting<AISettings>('ai_settings')
  const updateStaff = useUpdateStaff()

  const provider = aiSettings?.provider ?? 'ollama'
  const model = aiSettings?.model ?? 'qwen2.5:3b'
  const baseUrl = aiSettings?.baseUrl ?? 'http://localhost:11434'

  return (
    <Screen scroll style={{ gap: 12 }}>
      <ScreenHeader title="Ayarlar" />

      {/* Kullanıcı bilgisi */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
            <UserRound size={24} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.base }}>
              {staff?.full_name ?? '—'}
            </Text>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
              {roleLabels[staff?.role ?? 'staff'] ?? staff?.role}
            </Text>
          </View>
          <Badge variant={staff?.role === 'admin' ? 'default' : 'secondary'}>
            {roleLabels[staff?.role ?? 'staff'] ?? staff?.role}
          </Badge>
        </View>
      </Card>

      {/* AI Ayarları */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Bot size={18} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>Yapay Zeka</Text>
        </View>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Sağlayıcı</Text>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>{provider}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Model</Text>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>{model}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Sunucu</Text>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }} numberOfLines={1}>{baseUrl}</Text>
          </View>
        </View>
      </Card>

      {/* Personel Listesi (admin) */}
      {staff?.role === 'admin' && (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Shield size={18} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>Personel ({staffList.length})</Text>
          </View>
          <View style={{ gap: 8 }}>
            {staffList.map((s) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.foreground, fontWeight: '500' }}>{s.full_name}</Text>
                  {s.phone && <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>{s.phone}</Text>}
                </View>
                <Pressable
                  onPress={() =>
                    updateStaff.mutate({
                      id: s.id,
                      patch: { role: s.role === 'admin' ? 'staff' : 'admin' },
                    })
                  }
                  hitSlop={8}
                >
                  <Badge variant={s.role === 'admin' ? 'default' : 'secondary'}>
                    {roleLabels[s.role] ?? s.role}
                  </Badge>
                </Pressable>
                <Pressable
                  onPress={() => updateStaff.mutate({ id: s.id, patch: { is_active: !s.is_active } })}
                  hitSlop={8}
                >
                  <Badge variant={s.is_active ? 'success' : 'destructive'}>
                    {s.is_active ? 'Aktif' : 'Pasif'}
                  </Badge>
                </Pressable>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Audit Log (admin) */}
      {staff?.role === 'admin' && (
        <Pressable
          onPress={() => navigation.navigate('AuditLogs')}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ClipboardList size={18} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.foreground, fontWeight: '600', flex: 1 }}>Audit Log</Text>
              <ChevronRight size={18} color={theme.colors.mutedForeground} />
            </View>
          </Card>
        </Pressable>
      )}

      {/* Uygulama Bilgisi */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Info size={18} color={theme.colors.mutedForeground} />
          <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>Uygulama</Text>
        </View>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Sürüm</Text>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>Elffarma Mobil v1.0</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Tema</Text>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>Black / Gold (Premium)</Text>
          </View>
        </View>
      </Card>

      {/* Çıkış */}
      <Pressable
        onPress={signOut}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 16,
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
          },
          pressed && { opacity: 0.6 },
        ]}
      >
        <LogOut size={18} color={theme.colors.destructive} />
        <Text style={{ color: theme.colors.destructive, fontWeight: '600', flex: 1 }}>Çıkış Yap</Text>
        <ChevronRight size={18} color={theme.colors.mutedForeground} />
      </Pressable>
    </Screen>
  )
}
