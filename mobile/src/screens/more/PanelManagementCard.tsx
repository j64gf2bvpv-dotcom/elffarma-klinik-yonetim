import * as React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { LayoutGrid, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react-native'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useTheme } from '@/lib/ThemeContext'
import { useStaffList, useUpdateStaff } from '@/features/staff/hooks'
import { useAppSetting, useSaveAppSetting } from '@/features/appSettings/hooks'
import { MANAGEABLE_ITEMS, MORE_MENU_ORDER_SETTING_KEY, type MenuItem } from './MoreMenuScreen'

/**
 * Ayarlar > admin-only kart — kullanıcı isteğiyle (2026-08-17) mobil
 * "Daha Fazla" menüsündeki panellerin (1) herkes için ortak sırasını ve
 * (2) personel bazında görünürlüğünü admin buradan yönetiyor. Sıralama
 * app_settings['mobile_more_menu_order'] altında tek bir global liste
 * (products.sort_order'daki gibi sürükleme değil, basit yukarı/aşağı —
 * mobilde hazır bir drag-list kütüphanesi kurulu değil); görünürlük ise
 * staff.mobile_hidden_panels üzerinden personel bazında.
 */
export function PanelManagementCard() {
  const theme = useTheme()
  const { data: staffList = [] } = useStaffList()
  const updateStaff = useUpdateStaff()
  const { data: savedOrder = [] } = useAppSetting<string[]>(MORE_MENU_ORDER_SETTING_KEY)
  const saveOrder = useSaveAppSetting<string[]>()
  const [selectedStaffId, setSelectedStaffId] = React.useState<string | null>(null)

  const orderedItems = React.useMemo(() => {
    if (!savedOrder || savedOrder.length === 0) return MANAGEABLE_ITEMS
    const byKey = new Map(MANAGEABLE_ITEMS.map((i) => [i.key, i]))
    const ordered = savedOrder.map((k) => byKey.get(k)).filter((i): i is MenuItem => !!i)
    const missing = MANAGEABLE_ITEMS.filter((i) => !savedOrder.includes(i.key))
    return [...ordered, ...missing]
  }, [savedOrder])

  function move(index: number, dir: -1 | 1) {
    const next = [...orderedItems]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    saveOrder.mutate({ key: MORE_MENU_ORDER_SETTING_KEY, value: next.map((i) => i.key) })
  }

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId) ?? staffList[0]
  const hiddenSet = new Set(selectedStaff?.mobile_hidden_panels ?? [])

  function toggleHidden(key: string) {
    if (!selectedStaff) return
    const next = hiddenSet.has(key) ? [...hiddenSet].filter((k) => k !== key) : [...hiddenSet, key]
    updateStaff.mutate({ id: selectedStaff.id, patch: { mobile_hidden_panels: next } })
  }

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <LayoutGrid size={18} color={theme.colors.primary} />
        <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>Panel Yönetimi (Daha Fazla)</Text>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>
          Sıralama (herkes için ortak)
        </Text>
        {orderedItems.map((item, index) => (
          <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
            <Text style={{ color: theme.colors.foreground, flex: 1, fontSize: theme.fontSizes.sm }} numberOfLines={1}>
              {item.label}
            </Text>
            <Pressable onPress={() => move(index, -1)} disabled={index === 0} hitSlop={8}>
              <ChevronUp size={18} color={index === 0 ? theme.colors.border : theme.colors.foreground} />
            </Pressable>
            <Pressable onPress={() => move(index, 1)} disabled={index === orderedItems.length - 1} hitSlop={8}>
              <ChevronDown size={18} color={index === orderedItems.length - 1 ? theme.colors.border : theme.colors.foreground} />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>
          Görünürlük (personel seç)
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {staffList.map((s) => (
            <Pressable key={s.id} onPress={() => setSelectedStaffId(s.id)} hitSlop={4}>
              <Badge variant={selectedStaff?.id === s.id ? 'default' : 'outline'}>{s.full_name}</Badge>
            </Pressable>
          ))}
        </ScrollView>
        {selectedStaff && (
          <View style={{ gap: 2, marginTop: 4 }}>
            {MANAGEABLE_ITEMS.map((item) => {
              const hidden = hiddenSet.has(item.key)
              return (
                <Pressable
                  key={item.key}
                  onPress={() => toggleHidden(item.key)}
                  style={({ pressed }) => [
                    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  {hidden ? <EyeOff size={16} color={theme.colors.mutedForeground} /> : <Eye size={16} color={theme.colors.primary} />}
                  <Text
                    style={{
                      color: hidden ? theme.colors.mutedForeground : theme.colors.foreground,
                      flex: 1,
                      fontSize: theme.fontSizes.sm,
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )}
      </View>
    </Card>
  )
}
