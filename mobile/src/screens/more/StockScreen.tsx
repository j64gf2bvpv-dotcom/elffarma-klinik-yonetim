import * as React from 'react'
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native'
import { AppModal } from '@/components/ui/AppModal'
import { Layers, Minus, PackageSearch, Plus, X } from 'lucide-react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useCreateProductLot, useProducts, useProductLots, useRecordStockMovement } from '@/features/stock/hooks'
import { getExpiryStatus } from '@shared/businessLogic/expiry'
import type { MoreStackParamList } from '@/navigation/types'
import type { MovementType, Product } from '@shared/types/database'

const NO_LOT = '__none__'
const NEW_LOT = '__new__'

type Props = NativeStackScreenProps<MoreStackParamList, 'Stock'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

/**
 * Personelin ürünleri günlük görüp stok hareketi (giriş/çıkış) kaydedebilmesi
 * için Stok listesi — mevcut record_stock_movement RPC'sini (CLAUDE.md
 * kuralı: current_quantity'ye asla doğrudan yazılmaz) kullanan
 * useRecordStockMovement hook'unu ekliyor; sipariş ekranı zaten aynı RPC'yle
 * doktora satışta stok düşüyordu (CreateOrderScreen.tsx), burada elle
 * giriş/çıkış (mal kabul, sayım düzeltmesi, numune vb.) yapılabiliyor.
 * Dashboard'daki "kritik stok" uyarısından `onlyCritical` param'ıyla
 * doğrudan filtrelenmiş buraya gelinebiliyor.
 */
export function StockScreen({ route }: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState<string | null>(null)
  const [onlyCritical, setOnlyCritical] = React.useState(!!route.params?.onlyCritical)
  const [refreshing, setRefreshing] = React.useState(false)
  const [movementProduct, setMovementProduct] = React.useState<Product | null>(null)
  const [movementType, setMovementType] = React.useState<MovementType>('in')
  const [lotsProduct, setLotsProduct] = React.useState<Product | null>(null)

  function openMovement(product: Product, type: MovementType) {
    setMovementType(type)
    setMovementProduct(product)
  }

  const { data: products = [], isLoading } = useProducts(search)

  const categories = React.useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter((c): c is string => !!c))
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [products])

  const rows = React.useMemo(
    () =>
      products
        .filter((p) => category == null || p.category === category)
        .filter((p) => !onlyCritical || p.current_quantity <= p.critical_stock_threshold)
        .sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [products, category, onlyCritical],
  )

  const criticalCount = products.filter((p) => p.current_quantity <= p.critical_stock_threshold).length

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['products'] })
    setRefreshing(false)
  }

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader title="Stok" subtitle={`${products.length} ürün · ${criticalCount} kritik seviyede`} />
      <TextField placeholder="Ara (ürün adı)..." value={search} onChangeText={setSearch} containerStyle={{ marginBottom: 2 }} />

      {/* Önceden yatay ScrollView'dı — kategori sayısı arttıkça son çip(ler)
          ekran dışında kayıp fark edilmiyordu. Artık sığmayan çipler alt
          satıra sarılıyor, hepsi tek bakışta görünüyor. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Pressable onPress={() => setCategory(null)} hitSlop={4}>
          <Badge variant={category == null ? 'default' : 'outline'}>Tümü</Badge>
        </Pressable>
        {categories.map((c) => (
          <Pressable key={c} onPress={() => setCategory(c)} hitSlop={4}>
            <Badge variant={category === c ? 'default' : 'outline'}>{c}</Badge>
          </Pressable>
        ))}
        {criticalCount > 0 && (
          <Pressable onPress={() => setOnlyCritical((v) => !v)} hitSlop={4}>
            <Badge variant={onlyCritical ? 'destructive' : 'outline'}>{`Kritik (${criticalCount})`}</Badge>
          </Pressable>
        )}
      </View>

      {isLoading && rows.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Ürün yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              onPress={() => openMovement(item, 'in')}
              onQuickIn={() => openMovement(item, 'in')}
              onQuickOut={() => openMovement(item, 'out')}
              onLots={() => setLotsProduct(item)}
            />
          )}
        />
      )}

      <StockMovementModal product={movementProduct} initialType={movementType} onClose={() => setMovementProduct(null)} />
      <ProductLotsModal product={lotsProduct} onClose={() => setLotsProduct(null)} />
    </Screen>
  )
}

function ProductRow({
  product,
  onPress,
  onQuickIn,
  onQuickOut,
  onLots,
}: {
  product: Product
  onPress: () => void
  onQuickIn: () => void
  onQuickOut: () => void
  onLots: () => void
}) {
  const theme = useTheme()
  const critical = product.current_quantity <= product.critical_stock_threshold
  const expiry = getExpiryStatus(product.expiry_date)

  return (
    <ListItemCard
      icon={PackageSearch}
      iconColor={critical ? theme.colors.destructive : theme.colors.primary}
      imageUri={product.image_url}
      title={product.name}
      subtitle={[product.category, product.brand_line, product.unit_price != null ? currency(product.unit_price) : null]
        .filter(Boolean)
        .join(' · ')}
      onPress={onPress}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Badge variant={critical ? 'destructive' : 'secondary'}>
              {`${product.current_quantity} ${product.unit}`}
            </Badge>
            {expiry === 'expired' && <Badge variant="destructive">Süresi Doldu</Badge>}
            {expiry === 'soon' && <Badge variant="warning">Yakında Doluyor</Badge>}
          </View>
          <View style={{ gap: 6 }}>
            <Pressable
              onPress={onQuickIn}
              hitSlop={6}
              style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.success + '26', alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={13} color={theme.colors.success} />
            </Pressable>
            <Pressable
              onPress={onQuickOut}
              hitSlop={6}
              style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.destructive + '26', alignItems: 'center', justifyContent: 'center' }}
            >
              <Minus size={13} color={theme.colors.destructive} />
            </Pressable>
            <Pressable
              onPress={onLots}
              hitSlop={6}
              style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.primary + '26', alignItems: 'center', justifyContent: 'center' }}
            >
              <Layers size={13} color={theme.colors.primary} />
            </Pressable>
          </View>
        </View>
      }
    />
  )
}

/** Masaüstündeki ProductLotsDialog'un mobil karşılığı — salt okunur lot listesi
 * (lot no, SKT, depo/raf, tedarikçi, miktar). Lot ekleme StockMovementModal
 * içindeki "Yeni Lot" akışından yapılır (masaüstüyle aynı desen). */
function ProductLotsModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const theme = useTheme()
  const { data: lots = [], isLoading } = useProductLots(product?.id)

  return (
    <AppModal visible={!!product} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing(5),
            gap: 12,
            maxHeight: '75%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              Lotlar — {product?.name}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={22} color={theme.colors.foreground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {isLoading && <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>}
            {!isLoading && lots.length === 0 && (
              <Text style={{ color: theme.colors.mutedForeground }}>Bu ürün için lot kaydı yok</Text>
            )}
            {lots.map((lot) => {
              const status = getExpiryStatus(lot.expiry_date, 90)
              return (
                <ListItemCard
                  key={lot.id}
                  icon={Layers}
                  iconColor={status === 'expired' ? theme.colors.destructive : status === 'soon' ? theme.colors.warning : theme.colors.mutedForeground}
                  title={lot.lot_no ?? 'Lot'}
                  subtitle={[lot.warehouse, lot.shelf].filter(Boolean).join(' / ') || lot.supplier || undefined}
                  right={
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Badge variant="secondary">{lot.quantity} adet</Badge>
                      {lot.expiry_date && (
                        <Badge variant={status === 'expired' ? 'destructive' : status === 'soon' ? 'warning' : 'outline'}>
                          {format(new Date(lot.expiry_date), 'd MMM yyyy', { locale: trLocale })}
                        </Badge>
                      )}
                    </View>
                  }
                />
              )
            })}
          </ScrollView>
        </View>
      </View>
    </AppModal>
  )
}

function StockMovementModal({
  product,
  initialType,
  onClose,
}: {
  product: Product | null
  initialType: MovementType
  onClose: () => void
}) {
  const theme = useTheme()
  const recordMovement = useRecordStockMovement()
  const createLot = useCreateProductLot()
  const [type, setType] = React.useState<MovementType>('in')
  const [quantity, setQuantity] = React.useState('')
  const [note, setNote] = React.useState('')
  const [lotId, setLotId] = React.useState<string>(NO_LOT)
  const [newLot, setNewLot] = React.useState({ lot_no: '', expiry_date: '', warehouse: '', shelf: '' })
  const { data: lots = [] } = useProductLots(product?.id)

  React.useEffect(() => {
    if (product) {
      setType(initialType)
      setQuantity('')
      setNote('')
      setLotId(NO_LOT)
      setNewLot({ lot_no: '', expiry_date: '', warehouse: '', shelf: '' })
    }
  }, [product, initialType])

  async function onSave() {
    if (!product) return
    const qty = Number(quantity)
    if (!qty || qty <= 0) return
    let resolvedLotId: string | null = lotId !== NO_LOT && lotId !== NEW_LOT ? lotId : null
    if (lotId === NEW_LOT) {
      const created = await createLot.mutateAsync({
        product_id: product.id,
        lot_no: newLot.lot_no || null,
        expiry_date: newLot.expiry_date || null,
        warehouse: newLot.warehouse || null,
        shelf: newLot.shelf || null,
      })
      resolvedLotId = created.id
    }
    await recordMovement.mutateAsync({
      product_id: product.id,
      movement_type: type,
      quantity: qty,
      note: note.trim() || null,
      lot_id: resolvedLotId,
    })
    onClose()
  }

  return (
    <AppModal visible={!!product} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing(5),
            gap: 12,
            maxHeight: '88%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              {product?.name}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={22} color={theme.colors.foreground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
            Güncel stok: {product?.current_quantity} {product?.unit}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              variant={type === 'in' ? 'default' : 'outline'}
              style={{ flex: 1 }}
              onPress={() => setType('in')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Plus size={16} color={type === 'in' ? theme.colors.primaryForeground : theme.colors.foreground} />
                <Text style={{ color: type === 'in' ? theme.colors.primaryForeground : theme.colors.foreground, fontWeight: '600' }}>
                  Giriş
                </Text>
              </View>
            </Button>
            <Button
              variant={type === 'out' ? 'destructive' : 'outline'}
              style={{ flex: 1 }}
              onPress={() => setType('out')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Minus size={16} color={type === 'out' ? theme.colors.destructiveForeground : theme.colors.foreground} />
                <Text style={{ color: type === 'out' ? theme.colors.destructiveForeground : theme.colors.foreground, fontWeight: '600' }}>
                  Çıkış
                </Text>
              </View>
            </Button>
          </View>

          <TextField label="Miktar *" value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="0" />

          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '600' }}>Lot (opsiyonel)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
              <Pressable onPress={() => setLotId(NO_LOT)} hitSlop={4}>
                <Badge variant={lotId === NO_LOT ? 'default' : 'outline'}>Lot takibi yok</Badge>
              </Pressable>
              {lots.map((lot) => (
                <Pressable key={lot.id} onPress={() => setLotId(lot.id)} hitSlop={4}>
                  <Badge variant={lotId === lot.id ? 'default' : 'outline'}>
                    {(lot.lot_no ?? 'Lot') + (lot.expiry_date ? ` — SKT: ${format(new Date(lot.expiry_date), 'd MMM yyyy', { locale: trLocale })}` : '') + ` (${lot.quantity})`}
                  </Badge>
                </Pressable>
              ))}
              <Pressable onPress={() => setLotId(NEW_LOT)} hitSlop={4}>
                <Badge variant={lotId === NEW_LOT ? 'default' : 'outline'}>+ Yeni Lot</Badge>
              </Pressable>
            </ScrollView>
          </View>

          {lotId === NEW_LOT && (
            <View style={{ gap: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, padding: theme.spacing(3) }}>
              <TextField label="Lot No" value={newLot.lot_no} onChangeText={(v) => setNewLot((s) => ({ ...s, lot_no: v }))} />
              <TextField
                label="SKT"
                value={newLot.expiry_date}
                onChangeText={(v) => setNewLot((s) => ({ ...s, expiry_date: v }))}
                placeholder="YYYY-MM-DD"
              />
              <TextField label="Depo" value={newLot.warehouse} onChangeText={(v) => setNewLot((s) => ({ ...s, warehouse: v }))} />
              <TextField label="Raf" value={newLot.shelf} onChangeText={(v) => setNewLot((s) => ({ ...s, shelf: v }))} />
            </View>
          )}

          <TextField label="Not" value={note} onChangeText={setNote} placeholder="Örn: Sayım düzeltmesi" />

          <Button onPress={onSave} loading={recordMovement.isPending || createLot.isPending} disabled={!Number(quantity)}>
            Kaydet
          </Button>
          </ScrollView>
        </View>
      </View>
    </AppModal>
  )
}
