import * as React from 'react'
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { FileText, Share2, Trash2 } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useQuotes, useUpdateQuoteStatus, useDeleteQuote } from '@/features/quotes/hooks'
import { fetchQuoteItems } from '@/features/quotes/api'
import { generateAndShareQuotePdf } from '@/features/quotes/generateQuotePdf'
import type { QuoteStatus } from '@shared/types/database'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Quotes'>

const statusLabels: Record<QuoteStatus, string> = {
  taslak: 'Taslak',
  gonderildi: 'Gönderildi',
  goruldu: 'Görüldü',
  kabul_edildi: 'Kabul Edildi',
  reddedildi: 'Reddedildi',
  suresi_doldu: 'Süresi Doldu',
}

const statusVariants: Record<QuoteStatus, 'secondary' | 'outline' | 'default' | 'success' | 'destructive'> = {
  taslak: 'outline',
  gonderildi: 'default',
  goruldu: 'default',
  kabul_edildi: 'success',
  reddedildi: 'destructive',
  suresi_doldu: 'destructive',
}

const statusFilters: (QuoteStatus | 'all')[] = ['all', 'taslak', 'gonderildi', 'goruldu', 'kabul_edildi', 'reddedildi']

/** Master talimat §20'deki teklif listesi + durum takibi + PDF paylaşımı. */
export function QuotesScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [filter, setFilter] = React.useState<QuoteStatus | 'all'>('all')
  const [sharingId, setSharingId] = React.useState<string | null>(null)
  const { data: quotes = [], isLoading } = useQuotes(filter)
  const updateStatus = useUpdateQuoteStatus()
  const deleteMutation = useDeleteQuote()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['quotes'] })
    setRefreshing(false)
  }

  async function onShare(quote: (typeof quotes)[number]) {
    setSharingId(quote.id)
    try {
      const items = await fetchQuoteItems(quote.id)
      await generateAndShareQuotePdf(quote, items, quote.customer_name)
      if (quote.status === 'taslak') updateStatus.mutate({ id: quote.id, status: 'gonderildi' })
    } finally {
      setSharingId(null)
    }
  }

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader title="Teklifler" subtitle={`${quotes.length} kayıt`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
        {statusFilters.map((s) => (
          <Pressable key={s} onPress={() => setFilter(s)} hitSlop={4}>
            <Badge variant={filter === s ? 'default' : 'outline'}>{s === 'all' ? 'Tümü' : statusLabels[s]}</Badge>
          </Pressable>
        ))}
      </ScrollView>
      {isLoading && quotes.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(q) => q.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <ListItemCard
              icon={FileText}
              iconColor={theme.colors.primary}
              title={item.customer_name}
              subtitle={`${item.quote_number} · ${format(new Date(item.created_at), 'd MMM yyyy', { locale: trLocale })}`}
              right={
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Badge variant={statusVariants[item.status]}>{statusLabels[item.status]}</Badge>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable onPress={() => onShare(item)} hitSlop={8} disabled={sharingId === item.id}>
                      <Share2 size={16} color={sharingId === item.id ? theme.colors.mutedForeground : theme.colors.primary} />
                    </Pressable>
                    <Pressable onPress={() => deleteMutation.mutate(item.id)} hitSlop={8}>
                      <Trash2 size={14} color={theme.colors.mutedForeground} />
                    </Pressable>
                  </View>
                </View>
              }
            />
          )}
        />
      )}
    </Screen>
  )
}
