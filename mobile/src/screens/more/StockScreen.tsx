import * as React from 'react'
import { FlatList, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { AppModal } from '@/components/ui/AppModal'
import { FileText, Minus, PackageSearch, Plus, X } from 'lucide-react-native'
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
import { useAuth } from '@/lib/auth'
import { useProducts, useRecordStockMovement } from '@/features/stock/hooks'
import { useAttachments, useAttachmentUrl, useProductIdsWithAttachments } from '@/features/attachments/hooks'
import { getExpiryStatus } from '@shared/businessLogic/expiry'
import type { MoreStackParamList } from '@/navigation/types'
import type { MovementType, Product } from '@shared/types/database'

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
 *
 * Stok hareketi (giriş/çıkış, "sayım düzeltmesi") kullanıcı isteğiyle
 * (2026-08-17) sadece admin'e açık — diğer personel listeyi görür ama
 * miktar düzeltemez, +/- butonları ve satıra dokunma bu yüzden isAdmin'e
 * bağlı.
 */
export function StockScreen({ route }: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const { staff } = useAuth()
  const isAdmin = staff?.role === 'admin'
  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState<string | null>(null)
  const [onlyCritical, setOnlyCritical] = React.useState(!!route.params?.onlyCritical)
  const [refreshing, setRefreshing] = React.useState(false)
  const [movementProduct, setMovementProduct] = React.useState<Product | null>(null)
  const [movementType, setMovementType] = React.useState<MovementType>('in')
  const [pdfProduct, setPdfProduct] = React.useState<Product | null>(null)

  function openMovement(product: Product, type: MovementType) {
    setMovementType(type)
    setMovementProduct(product)
  }

  const { data: products = [], isLoading } = useProducts(search)
  const { data: productIdsWithPdf = [] } = useProductIdsWithAttachments()
  const pdfIdSet = React.useMemo(() => new Set(productIdsWithPdf), [productIdsWithPdf])

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
      <ScreenHeader title="Ürünler ve Stok" subtitle={`${products.length} ürün · ${criticalCount} kritik seviyede`} />
      <TextField placeholder="Ara (ürün adı)..." value={search} onChangeText={setSearch} containerStyle={{ marginBottom: 2 }} />

      {/* Kullanıcı isteğiyle (2026-08-17) tekrar yatay kaydırmaya çevrildi —
          alt satıra sarma, "Tümü" ile kategoriler arasında ürün listesine
          bakarken gereksiz yer kaplıyordu. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
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
      </ScrollView>

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
              isAdmin={isAdmin}
              hasPdf={pdfIdSet.has(item.id)}
              onPress={isAdmin ? () => openMovement(item, 'in') : undefined}
              onQuickIn={() => openMovement(item, 'in')}
              onQuickOut={() => openMovement(item, 'out')}
              onOpenPdf={() => setPdfProduct(item)}
            />
          )}
        />
      )}

      <StockMovementModal product={movementProduct} initialType={movementType} onClose={() => setMovementProduct(null)} />
      <ProductPdfModal product={pdfProduct} onClose={() => setPdfProduct(null)} />
    </Screen>
  )
}

function ProductRow({
  product,
  isAdmin,
  hasPdf,
  onPress,
  onQuickIn,
  onQuickOut,
  onOpenPdf,
}: {
  product: Product
  isAdmin: boolean
  hasPdf: boolean
  onPress?: () => void
  onQuickIn: () => void
  onQuickOut: () => void
  onOpenPdf: () => void
}) {
  const theme = useTheme()
  const critical = product.current_quantity <= product.critical_stock_threshold
  const expiry = getExpiryStatus(product.expiry_date)

  // Kullanıcı isteğiyle (2026-08-17) ürün adının altına sırayla SKT ve
  // fiyat — kategori/ürün hattı bu satırdan kaldırıldı.
  const subtitleLines = [
    product.expiry_date ? `SKT: ${format(new Date(product.expiry_date), 'd MMM yyyy', { locale: trLocale })}` : null,
    product.unit_price != null ? currency(product.unit_price) : null,
  ].filter(Boolean)

  return (
    <ListItemCard
      icon={PackageSearch}
      iconColor={critical ? theme.colors.destructive : theme.colors.primary}
      imageUri={product.image_url}
      title={product.name}
      subtitle={subtitleLines.join('\n')}
      subtitleNumberOfLines={2}
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
          {hasPdf && (
            <Pressable
              onPress={onOpenPdf}
              hitSlop={6}
              style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.primary + '26', alignItems: 'center', justifyContent: 'center' }}
            >
              <FileText size={13} color={theme.colors.primary} />
            </Pressable>
          )}
          {isAdmin && (
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
            </View>
          )}
        </View>
      }
    />
  )
}

/** Admin'in (masaüstünden, Ürün Düzenle > Belgeler) ürüne eklediği PDF/
 * katalog dosyalarını satış elemanlarının görüntülemesi için — kullanıcı
 * isteğiyle (2026-08-17). Yükleme mobilde yok (expo-document-picker kurulu
 * değil), sadece görüntüleme: imzalı URL alınıp cihazın kendi tarayıcısında/
 * PDF görüntüleyicisinde açılıyor. */
function ProductPdfModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const theme = useTheme()
  const { data: files = [], isLoading } = useAttachments('product', product?.id ?? '')
  const getUrl = useAttachmentUrl()

  async function openFile(path: string) {
    const url = await getUrl.mutateAsync(path)
    Linking.openURL(url)
  }

  return (
    <AppModal visible={!!product} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, minHeight: 0, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing(5),
            gap: 12,
            maxHeight: '75%',
            minHeight: 0,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              Belgeler — {product?.name}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={22} color={theme.colors.foreground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {isLoading && <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>}
            {files.map((f) => (
              <ListItemCard
                key={f.id}
                icon={FileText}
                title={f.file_name}
                subtitle={format(new Date(f.created_at), 'd MMM yyyy', { locale: trLocale })}
                onPress={() => openFile(f.file_path)}
              />
            ))}
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
  const [type, setType] = React.useState<MovementType>('in')
  const [quantity, setQuantity] = React.useState('')
  const [note, setNote] = React.useState('')

  React.useEffect(() => {
    if (product) {
      setType(initialType)
      setQuantity('')
      setNote('')
    }
  }, [product, initialType])

  async function onSave() {
    if (!product) return
    const qty = Number(quantity)
    if (!qty || qty <= 0) return
    await recordMovement.mutateAsync({
      product_id: product.id,
      movement_type: type,
      quantity: qty,
      note: note.trim() || null,
    })
    onClose()
  }

  return (
    <AppModal visible={!!product} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, minHeight: 0, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing(5),
            gap: 12,
            maxHeight: '88%',
            minHeight: 0,
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

          <TextField label="Not" value={note} onChangeText={setNote} placeholder="Örn: Sayım düzeltmesi" />

          <Button onPress={onSave} loading={recordMovement.isPending} disabled={!Number(quantity)}>
            Kaydet
          </Button>
          </ScrollView>
        </View>
      </View>
    </AppModal>
  )
}
