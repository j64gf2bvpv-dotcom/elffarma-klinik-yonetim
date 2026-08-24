import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import { recordStockMovement } from '@/features/stock/api'
import type { Product, StockCount, StockCountItem } from '@/types/database'

export type StockCountItemWithProduct = StockCountItem & {
  products: Pick<Product, 'name' | 'unit' | 'brand_line' | 'current_quantity' | 'flakon_quantity'>
}

function todayDate() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/**
 * "Bugünkü sayım" artık gerçek takvim tarihine değil, o an AÇIK olan sayıma
 * bağlı (kullanıcı isteğiyle, 2026-08-24: sayım tamamlanınca hemen YARINKİ
 * sayım — gerçek tarihi bir gün öndeki — başlatılıyor, bkz. completeCount).
 * Açık birden fazla sayım olması beklenmez ama olursa en güncel tarihli
 * olan gösterilir.
 */
export async function fetchTodayCount(): Promise<StockCount | null> {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('*')
    .eq('status', 'open')
    .order('count_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as StockCount | null
}

export async function fetchPastCounts(): Promise<StockCount[]> {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('*')
    .order('count_date', { ascending: false })
    .limit(30)
  if (error) throw error
  return data as StockCount[]
}

export async function fetchCountItems(stockCountId: string): Promise<StockCountItemWithProduct[]> {
  const { data, error } = await supabase
    .from('stock_count_items')
    .select('*, products(name, unit, brand_line, current_quantity, flakon_quantity)')
    .eq('stock_count_id', stockCountId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as unknown as StockCountItemWithProduct[]
}

async function createCountForDate(countDate: string, createdBy: string | null | undefined): Promise<StockCount> {
  const count = await offlineInsert<StockCount>(
    'stock_counts',
    { count_date: countDate, created_by: createdBy },
    'Günlük sayım başlatma',
  )

  // Sayım kalemleri, o anki ürün stoklarının canlı bir okumasına dayanıyor —
  // bu yüzden (AI sohbeti/ayarlar gibi) bağlantı gerektiren makul bir istisna:
  // offline'da anlamlı bir "o anki stok" listesi oluşturulamaz.
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, current_quantity, flakon_quantity')
    .eq('is_active', true)
  if (productsError) throw productsError

  if (products && products.length > 0) {
    const items = products.map((p) => ({
      stock_count_id: count.id,
      product_id: p.id,
      expected_quantity: p.current_quantity,
      expected_quantity_flakon: p.flakon_quantity,
    }))
    const { error: itemsError } = await supabase.from('stock_count_items').insert(items)
    if (itemsError) throw itemsError
  }

  return count
}

export async function startTodayCount(): Promise<StockCount> {
  const createdBy = await getCurrentUserId()
  return createCountForDate(todayDate(), createdBy)
}

/** Sayım başladıktan sonra unutulan/yanlışlıkla dahil edilmiş (ör. örnek/demo
 * ürünler) bir kalemi tek tek eklemek/çıkarmak için — `startTodayCount` tüm
 * aktif ürünleri toplu ekliyor ama sayım açıkken liste elle de düzenlenebilsin. */
export async function addCountItem(stockCountId: string, product: Pick<Product, 'id' | 'current_quantity' | 'flakon_quantity'>): Promise<void> {
  await offlineInsert(
    'stock_count_items',
    {
      stock_count_id: stockCountId,
      product_id: product.id,
      expected_quantity: product.current_quantity,
      expected_quantity_flakon: product.flakon_quantity,
    },
    'Sayıma ürün ekleme',
  )
}

export async function deleteCountItem(id: string): Promise<void> {
  await offlineDelete('stock_count_items', id, 'Sayımdan ürün çıkarma')
}

export async function updateCountItem(id: string, counted_quantity: number | null): Promise<void> {
  await offlineUpdate('stock_count_items', id, { counted_quantity }, 'Sayım kalemi güncelleme (paket)')
}

export async function updateCountItemFlakon(id: string, counted_quantity_flakon: number | null): Promise<void> {
  await offlineUpdate(
    'stock_count_items',
    id,
    { counted_quantity_flakon },
    'Sayım kalemi güncelleme (flakon)',
  )
}

/**
 * "Sistemdeki Miktar" artık canlı products stoğu değil, bir önceki
 * TAMAMLANMIŞ sayımın Son Stok değeri (kullanıcı isteğiyle, 2026-08-22) —
 * "en son sayım yaptığımız" rakam baz alınıyor. Paket/Flakon kutusu YENİDEN
 * bir tam sayım (recount) ifade ediyor: bugün girilen sayı önceki sayımla
 * aynıysa hiçbir hareket kaydedilmiyor ("eklemeden yaz"), farklıysa SADECE
 * aradaki fark (+/-) bir stok hareketi olarak uygulanıyor. Önceki sayım
 * yoksa (ilk sayım / yeni eklenen ürün) canlı products stoğuna düşülüyor —
 * başka anlamlı bir taban yok.
 */
export async function completeCount(stockCountId: string): Promise<void> {
  const items = await fetchCountItems(stockCountId)

  const { data: currentCount, error: currentCountError } = await supabase
    .from('stock_counts')
    .select('count_date')
    .eq('id', stockCountId)
    .single()
  if (currentCountError) throw currentCountError

  const { data: previousCounts, error: previousCountsError } = await supabase
    .from('stock_counts')
    .select('id')
    .eq('status', 'completed')
    .lt('count_date', currentCount.count_date)
    .order('count_date', { ascending: false })
    .limit(1)
  if (previousCountsError) throw previousCountsError
  const previousCountId = previousCounts?.[0]?.id ?? null

  const baselineByProduct = new Map<string, { paket: number; flakon: number }>()
  if (previousCountId) {
    const previousItems = await fetchCountItems(previousCountId)
    for (const item of previousItems) {
      // counted_quantity, o günün TAM sayım rakamı (taban + eklenen değil) —
      // bkz. dosya başı yorumu. Önceden burada yanlışlıkla expected+counted
      // toplanıyordu, bu da tabanı şişirip gerçekte olmayan bir "eksi stok"
      // hareketi denenmesine (Yeterli flakon stoğu yok hatası) yol açıyordu.
      baselineByProduct.set(item.product_id, {
        paket: item.counted_quantity ?? item.expected_quantity,
        flakon: item.counted_quantity_flakon ?? item.expected_quantity_flakon,
      })
    }
  }

  for (const item of items) {
    // "Önceki sayım" (baseline) sadece not metninde gösterge amaçlı — asıl
    // uygulanacak hareket HER ZAMAN canlı products stoğuna göre hesaplanır.
    // Bir önceki TAMAMLANMIŞ sayımdan bu yana satış/başka bir hareket olmuşsa
    // baseline canlı stoktan sapmış olabilir; fiziksel sayım (counted_quantity)
    // her zaman otoriter kabul edilip canlı stok doğrudan ona eşitlenir — bu
    // yüzden "Yeterli stok yok" hatası burada asla oluşamaz (kullanıcı isteği,
    // 2026-08-24: "burası hata vermemeli kaydetmeli"). Ayrıca bu tasarım,
    // yarıda kalıp tekrar denenen bir tamamlamayı da doğal olarak idempotent
    // yapar: ikinci denemede canlı stok zaten counted'a eşit olduğundan fark
    // sıfır çıkar, aynı hareket bir daha uygulanmaz.
    const displayBaseline = baselineByProduct.get(item.product_id) ?? {
      paket: item.products.current_quantity,
      flakon: item.products.flakon_quantity,
    }

    if (item.counted_quantity != null) {
      const delta = item.counted_quantity - item.products.current_quantity
      if (delta !== 0) {
        await recordStockMovement({
          product_id: item.product_id,
          movement_type: delta > 0 ? 'in' : 'out',
          quantity: Math.abs(delta),
          reason: 'Günlük sayım',
          note: `Önceki sayım: ${displayBaseline.paket}, Bugünkü sayım: ${item.counted_quantity}`,
          unit_kind: 'paket',
        })
      }
    }

    if (item.counted_quantity_flakon != null) {
      const deltaFlakon = item.counted_quantity_flakon - item.products.flakon_quantity
      if (deltaFlakon !== 0) {
        await recordStockMovement({
          product_id: item.product_id,
          movement_type: deltaFlakon > 0 ? 'in' : 'out',
          quantity: Math.abs(deltaFlakon),
          reason: 'Günlük sayım',
          note: `Önceki sayım: ${displayBaseline.flakon}, Bugünkü sayım: ${item.counted_quantity_flakon}`,
          unit_kind: 'flakon',
        })
      }
    }
  }

  await offlineUpdate(
    'stock_counts',
    stockCountId,
    { status: 'completed', completed_at: new Date().toISOString() },
    'Sayımı tamamlama',
  )

  // Kaydedince hemen bir sonraki günün sayımını başlat, boş giriş için hazır
  // olsun (kullanıcı isteği, 2026-08-24) — gerçek takvim tarihinin ilerlemesi
  // beklenmiyor, bkz. fetchTodayCount'taki "en güncel açık sayım" mantığı.
  const nextDate = addDaysToDateString(currentCount.count_date, 1)
  const { data: existingNext, error: existingNextError } = await supabase
    .from('stock_counts')
    .select('id')
    .eq('count_date', nextDate)
    .maybeSingle()
  if (existingNextError) throw existingNextError
  if (!existingNext) {
    const createdBy = await getCurrentUserId()
    await createCountForDate(nextDate, createdBy)
  }
}

export async function reopenCount(stockCountId: string): Promise<void> {
  await offlineUpdate('stock_counts', stockCountId, { status: 'open', completed_at: null }, 'Sayımı yeniden açma')
}
