import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, Eye, Trash2, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useCompetitorReports, useCreateCompetitorReport, useDeleteCompetitorReport } from '@/features/competitorReports/hooks'
import type { CompetitorStockStatus, CompetitorVisibility } from '@shared/types/database'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'CompetitorReports'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

const stockLabels: Record<CompetitorStockStatus, string> = {
  in_stock: 'Stokta',
  limited: 'Sınırlı',
  out_of_stock: 'Yok',
}

const stockVariants: Record<CompetitorStockStatus, 'default' | 'outline' | 'destructive'> = {
  in_stock: 'default',
  limited: 'outline',
  out_of_stock: 'destructive',
}

const visibilityLabels: Record<CompetitorVisibility, string> = {
  good: 'İyi',
  moderate: 'Orta',
  poor: 'Zayıf',
}

export function CompetitorReportsScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const { data: reports = [], isLoading } = useCompetitorReports()
  const deleteMutation = useDeleteCompetitorReport()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['competitor_reports'] })
    setRefreshing(false)
  }

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Rekabet Analizi"
        subtitle={`${reports.length} rapor`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      {isLoading && reports.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <ListItemCard
              icon={Eye}
              iconColor={theme.colors.primary}
              title={`${item.competitor_name} — ${item.product_name}`}
              subtitle={[
                item.doctor_name,
                format(new Date(item.created_at), 'd MMM yyyy', { locale: trLocale }),
                item.notes,
              ].filter(Boolean).join(' · ') || undefined}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {item.stock_status && (
                      <Badge variant={stockVariants[item.stock_status]}>{stockLabels[item.stock_status]}</Badge>
                    )}
                    {item.visibility && (
                      <Badge variant="outline">{visibilityLabels[item.visibility]}</Badge>
                    )}
                  </View>
                  {item.price != null && (
                    <Text style={{ color: theme.colors.foreground, fontWeight: '700' }}>{currency(Number(item.price))}</Text>
                  )}
                  <Pressable onPress={() => deleteMutation.mutate(item.id)} hitSlop={8}>
                    <Trash2 size={14} color={theme.colors.mutedForeground} />
                  </Pressable>
                </View>
              }
            />
          )}
        />
      )}
      <AddReportModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function AddReportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateCompetitorReport()
  const [doctorName, setDoctorName] = React.useState('')
  const [competitorName, setCompetitorName] = React.useState('')
  const [productName, setProductName] = React.useState('')
  const [price, setPrice] = React.useState('')
  const [stockStatus, setStockStatus] = React.useState<CompetitorStockStatus | ''>('')
  const [visibility, setVisibility] = React.useState<CompetitorVisibility | ''>('')
  const [notes, setNotes] = React.useState('')

  async function onSave() {
    if (!competitorName.trim() || !productName.trim()) return
    await createMutation.mutateAsync({
      doctor_name: doctorName.trim() || null,
      competitor_name: competitorName.trim(),
      product_name: productName.trim(),
      stock_status: stockStatus || null,
      price: price ? Number(price) : null,
      visibility: visibility || null,
      notes: notes.trim() || null,
    })
    setDoctorName(''); setCompetitorName(''); setProductName(''); setPrice(''); setStockStatus(''); setVisibility(''); setNotes('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Rekabet Raporu</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <TextField label="Doktor (opsiyonel)" value={doctorName} onChangeText={setDoctorName} placeholder="Dr. Ahmet Yılmaz" />
          <TextField label="Rakip Firma *" value={competitorName} onChangeText={setCompetitorName} placeholder="Örn: Allergan" />
          <TextField label="Ürün Adı *" value={productName} onChangeText={setProductName} placeholder="Örn: Botox 100U" />
          <TextField label="Fiyat" value={price} onChangeText={setPrice} placeholder="0" keyboardType="numeric" />
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '500' }}>Stok Durumu</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['in_stock', 'limited', 'out_of_stock'] as CompetitorStockStatus[]).map(s => (
              <Button key={s} variant={stockStatus === s ? 'default' : 'outline'} size="sm" onPress={() => setStockStatus(stockStatus === s ? '' : s)} style={{ flex: 1 }}>
                {stockLabels[s]}
              </Button>
            ))}
          </View>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '500' }}>Görünürlük</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['good', 'moderate', 'poor'] as CompetitorVisibility[]).map(v => (
              <Button key={v} variant={visibility === v ? 'default' : 'outline'} size="sm" onPress={() => setVisibility(visibility === v ? '' : v)} style={{ flex: 1 }}>
                {visibilityLabels[v]}
              </Button>
            ))}
          </View>
          <TextField label="Notlar" value={notes} onChangeText={setNotes} placeholder="Ek detay..." multiline />
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!competitorName.trim() || !productName.trim()}>
            Kaydet
          </Button>
        </View>
      </Screen>
    </Modal>
  )
}
