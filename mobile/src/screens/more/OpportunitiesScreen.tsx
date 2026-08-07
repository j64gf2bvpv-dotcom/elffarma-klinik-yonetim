import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, TrendingUp, Trash2, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { CustomerPickerModal } from '@/components/CustomerPickerModal'
import { useTheme } from '@/lib/ThemeContext'
import { useOpportunities, useCreateOpportunity, useUpdateOpportunity, useDeleteOpportunity } from '@/features/opportunities/hooks'
import type { CrmOpportunityStage } from '@shared/types/database'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Opportunities'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

const stageLabels: Record<CrmOpportunityStage, string> = {
  yeni: 'Yeni',
  teklif: 'Teklif',
  muzakere: 'Müzakere',
  kazanildi: 'Kazanıldı',
  kaybedildi: 'Kaybedildi',
}

const stageVariants: Record<CrmOpportunityStage, 'secondary' | 'outline' | 'destructive' | 'default'> = {
  yeni: 'secondary',
  teklif: 'default',
  muzakere: 'outline',
  kazanildi: 'default',
  kaybedildi: 'destructive',
}

const stages: (CrmOpportunityStage | 'all')[] = ['all', 'yeni', 'teklif', 'muzakere', 'kazanildi', 'kaybedildi']

export function OpportunitiesScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const [filter, setFilter] = React.useState<CrmOpportunityStage | 'all'>('all')
  const { data: opportunities = [], isLoading } = useOpportunities(filter)
  const updateMutation = useUpdateOpportunity()
  const deleteMutation = useDeleteOpportunity()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['crm_opportunities'] })
    setRefreshing(false)
  }

  const totalAmount = opportunities
    .filter(o => o.stage !== 'kaybedildi')
    .reduce((sum, o) => sum + (o.amount ?? 0), 0)
  const wonAmount = opportunities.filter(o => o.stage === 'kazanildi').reduce((sum, o) => sum + (o.amount ?? 0), 0)

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Fırsat Yönetimi"
        subtitle={`${opportunities.length} kayıt · ${currency(totalAmount)} açık`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ListItemCard icon={TrendingUp} iconColor={theme.colors.success} title={currency(wonAmount)} subtitle="Kazanılan" />
        <ListItemCard icon={TrendingUp} iconColor={theme.colors.primary} title={currency(totalAmount - wonAmount)} subtitle="Açık Pipeline" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
        {stages.map(s => (
          <Pressable key={s} onPress={() => setFilter(s)} hitSlop={4}>
            <Badge variant={filter === s ? 'default' : 'outline'}>
              {s === 'all' ? 'Tümü' : stageLabels[s]}
            </Badge>
          </Pressable>
        ))}
      </ScrollView>
      {isLoading && opportunities.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={opportunities}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <ListItemCard
              icon={TrendingUp}
              iconColor={item.stage === 'kazanildi' ? theme.colors.success : item.stage === 'kaybedildi' ? theme.colors.destructive : theme.colors.primary}
              title={item.title}
              subtitle={[
                item.customer_name,
                item.expected_close_date ? format(new Date(item.expected_close_date), 'd MMM yyyy', { locale: trLocale }) : null,
              ].filter(Boolean).join(' · ') || undefined}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {item.amount != null && (
                    <Text style={{ color: theme.colors.foreground, fontWeight: '700' }}>{currency(item.amount)}</Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                    <StageDropdown
                      value={item.stage}
                      onChange={(stage) => updateMutation.mutate({ id: item.id, patch: { stage } })}
                    />
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
      <AddOpportunityModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function StageDropdown({ value, onChange }: { value: CrmOpportunityStage; onChange: (s: CrmOpportunityStage) => void }) {
  const [open, setOpen] = React.useState(false)
  const theme = useTheme()
  return (
    <View>
      <Pressable onPress={() => setOpen(!open)} hitSlop={4}>
        <Badge variant={stageVariants[value]}>{stageLabels[value]}</Badge>
      </Pressable>
      {open && (
        <View style={{ position: 'absolute', top: 24, right: 0, backgroundColor: theme.colors.popover, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: 4, zIndex: 10, minWidth: 100 }}>
          {(Object.keys(stageLabels) as CrmOpportunityStage[]).map(s => (
            <Pressable key={s} onPress={() => { onChange(s); setOpen(false) }} style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
              <Text style={{ color: value === s ? theme.colors.primary : theme.colors.foreground, fontSize: theme.fontSizes.sm }}>{stageLabels[s]}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

function AddOpportunityModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateOpportunity()
  const [showCustomerPicker, setShowCustomerPicker] = React.useState(false)
  const [customerId, setCustomerId] = React.useState('')
  const [customerName, setCustomerName] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [closeDate, setCloseDate] = React.useState('')
  const [notes, setNotes] = React.useState('')

  async function onSave() {
    if (!customerId || !title.trim()) return
    await createMutation.mutateAsync({
      customer_id: customerId,
      title: title.trim(),
      amount: amount ? Number(amount) : null,
      expected_close_date: closeDate || null,
      notes: notes.trim() || null,
    })
    setCustomerId(''); setCustomerName(''); setTitle(''); setAmount(''); setCloseDate(''); setNotes('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Fırsat</Text>
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
          <TextField label="Başlık *" value={title} onChangeText={setTitle} placeholder="Örn: Botox 50 ünite siparişi" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextField label="Tutar" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" style={{ flex: 1 }} />
            <TextField label="Kapanış Tarihi" value={closeDate} onChangeText={setCloseDate} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
          </View>
          <TextField label="Notlar" value={notes} onChangeText={setNotes} placeholder="Detay..." multiline />
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!customerId || !title.trim()}>
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
