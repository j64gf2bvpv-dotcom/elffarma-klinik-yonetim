import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, Package, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { Card } from '@/components/ui/Card'
import { CustomerPickerModal } from '@/components/CustomerPickerModal'
import { useTheme } from '@/lib/ThemeContext'
import { useSampleRequests, useCreateSampleRequest, useUpdateSampleRequestStatus, useDeleteSampleRequest } from '@/features/samples/hooks'
import type { SampleRequestStatus } from '@shared/types/database'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Samples'>

const statusLabels: Record<SampleRequestStatus, string> = {
  pending: 'Beklemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  shipped: 'Gönderildi',
  delivered: 'Teslim Edildi',
}

const statusVariants: Record<SampleRequestStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  shipped: 'outline',
  delivered: 'default',
}

const nextStatus: Record<SampleRequestStatus, SampleRequestStatus | null> = {
  pending: 'approved',
  approved: 'shipped',
  rejected: null,
  shipped: 'delivered',
  delivered: null,
}

export function SamplesScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const { data: requests = [], isLoading } = useSampleRequests()
  const statusMutation = useUpdateSampleRequestStatus()
  const deleteMutation = useDeleteSampleRequest()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['sample_requests'] })
    setRefreshing(false)
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Numune Talepleri"
        subtitle={`${pendingCount} bekleyen · ${requests.length} toplam`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      {isLoading && requests.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const isExpanded = expandedId === item.id
            const next = nextStatus[item.status]
            return (
              <View>
                <ListItemCard
                  icon={Package}
                  iconColor={item.status === 'delivered' ? theme.colors.success : item.status === 'rejected' ? theme.colors.destructive : theme.colors.primary}
                  title={item.customer_name}
                  subtitle={[
                    format(new Date(item.request_date), 'd MMM yyyy', { locale: trLocale }),
                    item.tracking_number ? `Takip: ${item.tracking_number}` : null,
                    `${item.items.length} ürün`,
                  ].filter(Boolean).join(' · ')}
                  right={
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Badge variant={statusVariants[item.status]}>{statusLabels[item.status]}</Badge>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {next && (
                          <Pressable onPress={() => statusMutation.mutate({ id: item.id, status: next })} hitSlop={4}>
                            <Text style={{ color: theme.colors.primary, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>
                              {statusLabels[next]} →
                            </Text>
                          </Pressable>
                        )}
                        <Pressable onPress={() => setExpandedId(isExpanded ? null : item.id)} hitSlop={8}>
                          {isExpanded ? <ChevronUp size={14} color={theme.colors.mutedForeground} /> : <ChevronDown size={14} color={theme.colors.mutedForeground} />}
                        </Pressable>
                        <Pressable onPress={() => deleteMutation.mutate(item.id)} hitSlop={8}>
                          <Trash2 size={14} color={theme.colors.mutedForeground} />
                        </Pressable>
                      </View>
                    </View>
                  }
                />
                {isExpanded && item.items.length > 0 && (
                  <Card style={{ marginTop: 4, padding: 8, gap: 4 }}>
                    {item.items.map((it, idx) => (
                      <View key={it.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: idx > 0 ? 4 : 0, borderTopWidth: idx > 0 ? 1 : 0, borderColor: theme.colors.border }}>
                        <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, flex: 1 }}>
                          {it.quantity} ad · {it.lot_no ? `Lot: ${it.lot_no}` : 'Lot yok'}
                        </Text>
                        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
                          {it.unit_price > 0 ? it.unit_price.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }) : '—'}
                        </Text>
                      </View>
                    ))}
                    {item.note && (
                      <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, marginTop: 4, fontStyle: 'italic' }}>
                        Not: {item.note}
                      </Text>
                    )}
                  </Card>
                )}
              </View>
            )
          }}
        />
      )}
      <AddSampleModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function AddSampleModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateSampleRequest()
  const [showCustomerPicker, setShowCustomerPicker] = React.useState(false)
  const [customerId, setCustomerId] = React.useState('')
  const [customerName, setCustomerName] = React.useState('')
  const [note, setNote] = React.useState('')

  async function onSave() {
    if (!customerId) return
    await createMutation.mutateAsync({
      customer_id: customerId,
      note: note.trim() || null,
    })
    setCustomerId(''); setCustomerName(''); setNote('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Numune Talebi</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <Pressable onPress={() => setShowCustomerPicker(true)}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '500', marginBottom: 4 }}>Doktor *</Text>
            <View style={{ height: 44, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: theme.colors.input }}>
              <Text style={{ color: customerName ? theme.colors.foreground : theme.colors.mutedForeground }}>
                {customerName || 'Doktor seç...'}
              </Text>
            </View>
          </Pressable>
          <TextField label="Not" value={note} onChangeText={setNote} placeholder="Talep detayı..." multiline />
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
            Not: Numune kalemleri (ürün/lot/adet) masaüstünden eklenir. Burada talep başlığı oluşturulur, durum akışı mobilden takip edilir.
          </Text>
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!customerId}>
            Kaydet
          </Button>
        </View>
        <CustomerPickerModal
          visible={showCustomerPicker}
          onClose={() => setShowCustomerPicker(false)}
          onSelect={(c) => {
            setCustomerId(c.id)
            setCustomerName(c.full_name)
            setShowCustomerPicker(false)
          }}
        />
      </Screen>
    </Modal>
  )
}
