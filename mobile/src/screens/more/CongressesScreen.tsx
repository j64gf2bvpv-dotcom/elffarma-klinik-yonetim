import * as React from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Presentation, MapPin, CheckCircle2 } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useTheme } from '@/lib/ThemeContext'
import { useCongresses } from '@/features/congresses/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Congresses'>

function currency(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

/** Master talimat §21'deki Kongre/Workshop modülü — liste görünümü,
 * dokunulunca CongressDetail'e (katılımcı listesi + yoklama) geçer. */
export function CongressesScreen({ navigation }: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const { data: congresses = [], isLoading } = useCongresses()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['congresses'] })
    setRefreshing(false)
  }

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader title="Kongreler" subtitle={`${congresses.length} kayıt`} />
      {isLoading && congresses.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={congresses}
          keyExtractor={(c) => c.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('CongressDetail', { congressId: item.id, congressName: item.name })}
            >
              <Card>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.radius.sm,
                    backgroundColor: (item.will_attend ? theme.colors.success : theme.colors.muted) + '26',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Presentation size={20} color={item.will_attend ? theme.colors.success : theme.colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.base }} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.start_date && (
                    <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, marginTop: 2 }}>
                      {format(new Date(item.start_date), 'd MMM', { locale: trLocale })}
                      {item.end_date && ` – ${format(new Date(item.end_date), 'd MMM yyyy', { locale: trLocale })}`}
                    </Text>
                  )}
                </View>
                {item.will_attend ? (
                  <Badge variant="success">
                    <CheckCircle2 size={10} color={theme.colors.successForeground} /> Katılıyor
                  </Badge>
                ) : (
                  <Badge variant="outline">Katılmıyor</Badge>
                )}
              </View>
              {(item.city || item.venue || item.hotel) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MapPin size={12} color={theme.colors.mutedForeground} />
                  <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }} numberOfLines={1}>
                    {[item.city, item.venue, item.hotel].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              )}
              {(item.single_person_price != null || item.two_person_price != null) && (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                  {item.single_person_price != null && (
                    <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                      Tek kişi: <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>{currency(item.single_person_price)}</Text>
                    </Text>
                  )}
                  {item.two_person_price != null && (
                    <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                      Çift kişi: <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>{currency(item.two_person_price)}</Text>
                    </Text>
                  )}
                </View>
              )}
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  )
}
