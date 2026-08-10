import * as React from 'react'
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, ChevronLeft, ChevronRight, Trash2, X, Building2 } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CustomerPickerModal } from '@/components/CustomerPickerModal'
import { useTheme } from '@/lib/ThemeContext'
import {
  useOpportunities,
  useCreateOpportunity,
  useUpdateOpportunity,
  useDeleteOpportunity,
  type OpportunityWithCustomer,
} from '@/features/opportunities/hooks'
import type { CrmOpportunityStage } from '@shared/types/database'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Opportunities'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

const stageOrder: CrmOpportunityStage[] = ['yeni', 'teklif', 'muzakere', 'kazanildi', 'kaybedildi']

const stageLabels: Record<CrmOpportunityStage, string> = {
  yeni: 'Yeni Lead',
  teklif: 'Teklif Verildi',
  muzakere: 'Müzakere',
  kazanildi: 'Kazanıldı',
  kaybedildi: 'Kaybedildi',
}

const COLUMN_WIDTH = 260

/**
 * Master talimat §14'teki "Fırsat / Sales Pipeline" Kanban görünümü — 5
 * aşama (Yeni Lead→Teklif Verildi→Müzakere→Kazanıldı/Kaybedildi) yatay
 * kaydırılabilir kolonlar halinde, her kolonda o aşamadaki fırsatların
 * kartları. Sürükle-bırak yerine (RN'de güvenilir DnD ek kütüphane
 * gerektirir) her kartta ‹ › butonlarıyla bir önceki/sonraki aşamaya
 * taşıma — aynı useUpdateOpportunity mutasyonunu kullanıyor, sadece
 * etkileşim şekli değişti.
 */
export function OpportunitiesScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const { data: opportunities = [], isLoading } = useOpportunities('all')
  const updateMutation = useUpdateOpportunity()
  const deleteMutation = useDeleteOpportunity()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['crm_opportunities'] })
    setRefreshing(false)
  }

  const byStage = React.useMemo(() => {
    const map = new Map<CrmOpportunityStage, OpportunityWithCustomer[]>()
    for (const stage of stageOrder) map.set(stage, [])
    for (const o of opportunities) map.get(o.stage)?.push(o)
    return map
  }, [opportunities])

  const totalAmount = opportunities.filter((o) => o.stage !== 'kaybedildi').reduce((sum, o) => sum + (o.amount ?? 0), 0)
  const wonAmount = opportunities.filter((o) => o.stage === 'kazanildi').reduce((sum, o) => sum + (o.amount ?? 0), 0)

  function moveStage(opp: OpportunityWithCustomer, direction: -1 | 1) {
    const idx = stageOrder.indexOf(opp.stage)
    const nextIdx = idx + direction
    if (nextIdx < 0 || nextIdx >= stageOrder.length) return
    updateMutation.mutate({ id: opp.id, patch: { stage: stageOrder[nextIdx] } })
  }

  return (
    <Screen style={{ gap: 10 }} scroll={false}>
      <ScreenHeader
        title="Fırsatlar"
        subtitle={`${opportunities.length} kayıt · ${currency(totalAmount)} açık`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Kazanılan</Text>
          <Text style={{ color: theme.colors.success, fontWeight: '700', fontSize: theme.fontSizes.lg }}>{currency(wonAmount)}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Açık Pipeline</Text>
          <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: theme.fontSizes.lg }}>{currency(totalAmount - wonAmount)}</Text>
        </Card>
      </View>

      {isLoading && opportunities.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        >
          {stageOrder.map((stage) => {
            const items = byStage.get(stage) ?? []
            const stageTotal = items.reduce((sum, o) => sum + (o.amount ?? 0), 0)
            return (
              <View key={stage} style={{ width: COLUMN_WIDTH, gap: 8 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.sm }}>
                    {stageLabels[stage]} ({items.length})
                  </Text>
                </View>
                {stageTotal > 0 && (
                  <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, paddingHorizontal: 4, marginTop: -6 }}>
                    {currency(stageTotal)}
                  </Text>
                )}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
                  {items.length === 0 && (
                    <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, paddingHorizontal: 4 }}>Boş</Text>
                  )}
                  {items.map((o) => (
                    <OpportunityCard
                      key={o.id}
                      opportunity={o}
                      onMoveLeft={stageOrder.indexOf(o.stage) > 0 ? () => moveStage(o, -1) : undefined}
                      onMoveRight={stageOrder.indexOf(o.stage) < stageOrder.length - 1 ? () => moveStage(o, 1) : undefined}
                      onDelete={() => deleteMutation.mutate(o.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            )
          })}
        </ScrollView>
      )}
      <AddOpportunityModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function OpportunityCard({
  opportunity,
  onMoveLeft,
  onMoveRight,
  onDelete,
}: {
  opportunity: OpportunityWithCustomer
  onMoveLeft?: () => void
  onMoveRight?: () => void
  onDelete: () => void
}) {
  const theme = useTheme()
  return (
    <Card style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Building2 size={13} color={theme.colors.mutedForeground} />
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, flex: 1 }} numberOfLines={1}>
          {opportunity.customer_name}
        </Text>
      </View>
      <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }} numberOfLines={2}>
        {opportunity.title}
      </Text>
      {opportunity.amount != null && (
        <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{currency(opportunity.amount)}</Text>
      )}
      {opportunity.expected_close_date && (
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
          {format(new Date(opportunity.expected_close_date), 'd MMM yyyy', { locale: trLocale })}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable onPress={onMoveLeft} disabled={!onMoveLeft} hitSlop={8}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.muted,
                opacity: onMoveLeft ? 1 : 0.3,
              }}
            >
              <ChevronLeft size={14} color={theme.colors.foreground} />
            </View>
          </Pressable>
          <Pressable onPress={onMoveRight} disabled={!onMoveRight} hitSlop={8}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.muted,
                opacity: onMoveRight ? 1 : 0.3,
              }}
            >
              <ChevronRight size={14} color={theme.colors.foreground} />
            </View>
          </Pressable>
        </View>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Trash2 size={14} color={theme.colors.mutedForeground} />
        </Pressable>
      </View>
    </Card>
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
