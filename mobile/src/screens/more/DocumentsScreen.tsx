import * as React from 'react'
import { Linking, RefreshControl, Text, View } from 'react-native'
import { FileText } from 'lucide-react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useAllProductAttachments, useAttachmentUrl } from '@/features/attachments/hooks'
import { useProducts } from '@/features/stock/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Documents'>

/**
 * Kullanıcı isteğiyle (2026-08-17, "Daha Fazla" mockup'ındaki "Dökümanlar")
 * — admin'in Ürünler ve Stok'tan ürünlere eklediği tüm broşür/katalog
 * belgelerini (resim + PDF), her ürüne tek tek girmeden tek listeden
 * görüp açabilmek için. Salt okunur — ekleme/silme yine ürün üzerinden
 * (Stok > ürüne dokun > Belgeler), admin'e özel.
 */
export function DocumentsScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [refreshing, setRefreshing] = React.useState(false)
  const { data: files = [], isLoading } = useAllProductAttachments()
  const { data: products = [] } = useProducts('')
  const getUrl = useAttachmentUrl()

  const productNameById = React.useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products])

  const rows = React.useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    return files
      .map((f) => ({ ...f, productName: productNameById.get(f.owner_id) ?? 'Ürün' }))
      .filter((f) => !q || f.productName.toLocaleLowerCase('tr').includes(q) || f.file_name.toLocaleLowerCase('tr').includes(q))
  }, [files, productNameById, search])

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['attachments', 'product'] })
    setRefreshing(false)
  }

  async function openFile(path: string) {
    const url = await getUrl.mutateAsync(path)
    Linking.openURL(url)
  }

  return (
    <Screen
      scroll
      style={{ gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <ScreenHeader title="Dökümanlar" subtitle={`${rows.length} belge`} />
      <TextField placeholder="Ara (ürün veya dosya adı)..." value={search} onChangeText={setSearch} containerStyle={{ marginBottom: 2 }} />

      {isLoading && rows.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : rows.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>
          {search ? 'Sonuç yok' : 'Henüz belge yok — admin Ürünler ve Stok\'tan ekleyebilir.'}
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {rows.map((f) => (
            <ListItemCard
              key={f.id}
              icon={FileText}
              title={f.file_name}
              subtitle={`${f.productName} · ${format(new Date(f.created_at), 'd MMM yyyy', { locale: trLocale })}`}
              onPress={() => openFile(f.file_path)}
            />
          ))}
        </View>
      )}
    </Screen>
  )
}
