import * as React from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { AppModal } from '@/components/ui/AppModal'
import { X } from 'lucide-react-native'
import { Screen } from '@/components/ui/Screen'
import { TextField } from '@/components/ui/TextField'
import { useTheme } from '@/lib/ThemeContext'
import { useCustomers } from '@/features/customers/hooks'
import type { Customer } from '@shared/types/database'

export function CustomerPickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean
  onClose: () => void
  onSelect: (customer: Customer) => void
}) {
  const theme = useTheme()
  const [search, setSearch] = React.useState('')
  const { data: customers = [], isLoading } = useCustomers(search)

  return (
    <AppModal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>
            Doktor Seç
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <TextField
          placeholder="Ara (ad, telefon)..."
          value={search}
          onChangeText={setSearch}
          containerStyle={{ marginBottom: 12 }}
          autoFocus
        />
        {isLoading && customers.length === 0 ? (
          <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
        ) : (
          <FlatList
            data={customers}
            keyExtractor={(c) => c.id}
            ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Sonuç yok</Text>}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onSelect(item)}
                style={({ pressed }) => [{ paddingVertical: 14 }, pressed && { opacity: 0.6 }]}
              >
                <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>{item.full_name}</Text>
                {item.hospital_name && (
                  <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>{item.hospital_name}</Text>
                )}
              </Pressable>
            )}
          />
        )}
      </Screen>
    </AppModal>
  )
}
