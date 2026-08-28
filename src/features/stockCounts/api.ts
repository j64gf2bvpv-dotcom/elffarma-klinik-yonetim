import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import { recordStockMovement } from '@/features/stock/api'
import type { Product, StockCount, StockCountItem } from '@/types/database'

export type StockCountItemWithProduct = StockCountItem & {
  products: Pick<Product, 'name' | 'unit' | 'brand_line' | 'current_quantity' | 'flakon_quantity' | 'sort_order'>
}

/** Stok Yönetimi sayfasıyla AYNI sıralama (sort_order artan, null'lar sonda,
 * sonra ad) — kullanıcı isteği, 2026-08-27: "stokla günlük sayımda ürünlerin
 * isim sıralaması da aynı olmalı". Sayım kalemleri veritabanında created_at'e
 * göre geliyor (sayım açılırken o anki sıradan bağımsız eklenmiş olabilir),
 * bu yüzden istemci tarafında Stok sayfasının PostgREST sıralamasıyla birebir
 * eşleşecek şekilde yeniden sıralanıyor. */
function sortByProductOrder(items: StockCountItemWithProduct[]): StockCountItemWithProduct[] {
  return [...items].sort((a, b) => {
    const soA = a.products.sort_order
    const soB = b.products.sort_order
    if (soA != null && soB != null && soA !== soB) return soA - soB
    if (soA != null && soB == null) return -1
    if (soA == null && soB != null) return 1
    return a.products.name.localeCompare(b.products.name, 'tr')
  })
}

export function todayDate() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/**
 * "Bugünkü sayım" gerçek takvim tarihine değil, tarihi en yeni olan sayım
 * satırına bağlı — durumu (açık/tamamlanmış) önemli değil. Bu tasarım,
 * sayımın gerçek takvimden BAĞIMSIZ, kendi kesintisiz zincirinde ilerlemesini
 * yansıtır: her tamamlama bir sonraki günü hemen otomatik açar (bkz.
 * completeCount), dolayısıyla normal akışta "en yeni tarihli satır" HER ZAMAN
 * o an üzerinde çalışılması gereken (yeni açılmış, boş) sayımdır.
 *
 * DÜZELTME (kullanıcı raporu, 2026-08-29: "sayımı tamamlayınca bir sonraki
 * güne geçtiğimde yaptığım sayımlar bir önceki günde görünmüyor"): önceki
 * sürüm, gerçek takvim tarihine (todayDate()) birebir eşleşen satırı HER
 * ZAMAN önceliklendiriyordu. Gerçek takvim günü ilerlemeden (aynı oturumda)
 * art arda birden fazla gün tamamlanınca bu, sistemin az önce TAMAMLANMIŞ
 * günü göstermeye devam edip yeni açılan sonraki günü hiç göstermemesine yol
 * açıyordu — kullanıcıya "verilerim kayboldu" gibi görünüyordu (oysa veri
 * kaybolmuyordu, sadece ekran yanlış günü gösteriyordu ve o gün "Geçmiş
 * Sayımlar" listesinden bilerek gizleniyordu, bkz. bu dosyanın Geçmiş
 * Sayımlar filtre mantığı). "En yeni tarihli satır" kuralı hem bu sorunu hem
 * de önceki 2026-08-28 hatasını (bugünün kendi satırı zaten TAMAMLANMIŞken
 * hiç görülmemesi) tek, basit bir kuralla çözer — çünkü tamamlanan bir satır,
 * bir sonraki gün otomatik açılana kadar zaten en yeni tarihli satırdır.
 */
export async function fetchTodayCount(): Promise<StockCount | null> {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('*')
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
    .select('*, products(name, unit, brand_line, current_quantity, flakon_quantity, sort_order)')
    .eq('stock_count_id', stockCountId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return sortByProductOrder(data as unknown as StockCountItemWithProduct[])
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

/**
 * Bugüne ait bir satır zaten varsa (ör. bir önceki sayım tamamlanırken
 * otomatik açılmış) ONU döner, ikinci bir INSERT DENEMEZ — stock_counts.
 * count_date UNIQUE kısıtı yüzünden aksi halde "duplicate key value
 * violates unique constraint stock_counts_count_date_key" hatasıyla
 * patlıyordu (kullanıcı raporu, 2026-08-28). fetchTodayCount zaten bugüne
 * ait satırı varsa göstermesi gerektiği için normal akışta bu fonksiyon
 * sadece gerçekten hiç satır yokken çağrılır — bu ek kontrol yarış
 * durumlarına karşı bir güvenlik payı.
 */
export async function startTodayCount(): Promise<StockCount> {
  const today = todayDate()
  const { data: existing, error: existingError } = await supabase
    .from('stock_counts')
    .select('*')
    .eq('count_date', today)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return existing as StockCount

  const createdBy = await getCurrentUserId()
  return createCountForDate(today, createdBy)
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

/**
 * "Sayımı Tamamla ve Stoğu Güncelle"nin uyguladığı stok hareketini geri alır
 * (kullanıcı isteği, 2026-08-28: "geri al butonu olsun yaptığım
 * değişiklikleri geri alsın"). completeCount ile TAM SİMETRİK: aynı taban
 * (bir önceki TAMAMLANMIŞ sayımın Son Stok'u, yoksa canlı stok) hesaplanır,
 * ama fark TERSİNE uygulanır — canlı stok bu sayımın uyguladığı yerden
 * (counted_quantity) tabana geri döndürülür. Sayım sonunda 'open' durumuna
 * alınır ki düzeltilip yeniden tamamlanabilsin. Not: bu sayımın
 * tamamlanmasından SONRA o ürünlerde başka bir hareket (ör. bir satış) da
 * olduysa geri alma bunu hesaba katmaz — taban değere düz bir tersine
 * çevirmedir, hareketlerin kendisini tek tek izleyip iptal eden bir "tam
 * zaman yolculuğu" değil (stock_movements'ta hangi hareketin hangi sayıma
 * ait olduğunu tutan bir referans yok).
 */
export async function undoCompleteCount(stockCountId: string): Promise<void> {
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
      baselineByProduct.set(item.product_id, {
        paket: item.counted_quantity ?? item.expected_quantity,
        flakon: item.counted_quantity_flakon ?? item.expected_quantity_flakon,
      })
    }
  }

  for (const item of items) {
    const baseline = baselineByProduct.get(item.product_id) ?? {
      paket: item.products.current_quantity,
      flakon: item.products.flakon_quantity,
    }

    if (item.counted_quantity != null) {
      const delta = baseline.paket - item.products.current_quantity
      if (delta !== 0) {
        await recordStockMovement({
          product_id: item.product_id,
          movement_type: delta > 0 ? 'in' : 'out',
          quantity: Math.abs(delta),
          reason: 'Günlük sayım geri alma',
          note: `Sayım geri alındı — stok ${baseline.paket} değerine döndürüldü`,
          unit_kind: 'paket',
        })
      }
    }

    if (item.counted_quantity_flakon != null) {
      const deltaFlakon = baseline.flakon - item.products.flakon_quantity
      if (deltaFlakon !== 0) {
        await recordStockMovement({
          product_id: item.product_id,
          movement_type: deltaFlakon > 0 ? 'in' : 'out',
          quantity: Math.abs(deltaFlakon),
          reason: 'Günlük sayım geri alma',
          note: `Sayım geri alındı — stok ${baseline.flakon} değerine döndürüldü`,
          unit_kind: 'flakon',
        })
      }
    }
  }

  await offlineUpdate('stock_counts', stockCountId, { status: 'open', completed_at: null }, 'Sayımı geri alma')
}

/**
 * Bir sayımın tarihini elle öne/arkaya alır (kullanıcı isteği, 2026-08-25) —
 * ör. yanlış tarihe düşmüş/kaydırılması gereken bir sayımı düzeltmek için.
 * Sadece count_date alanını değiştirir, kalemlere veya stoğa dokunmaz.
 */
export async function updateCountDate(stockCountId: string, countDate: string): Promise<void> {
  await offlineUpdate('stock_counts', stockCountId, { count_date: countDate }, 'Sayım tarihini değiştirme')
}

/**
 * Geçmiş Sayımlar listesindeki "Açık"/"Tamamlandı" durumunu doğrudan elle
 * değiştirir — completeCount'un aksine stok hareketi UYGULAMAZ, sadece etiket
 * değişir (kullanıcı isteği, 2026-08-24: geçmişte yarım kalmış eski sayımları
 * temizlemek için salt bir durum düzeltmesi, gerçek bir "tamamlama işlemi"
 * değil).
 */
export async function setCountStatusManually(stockCountId: string, status: StockCount['status']): Promise<void> {
  await offlineUpdate(
    'stock_counts',
    stockCountId,
    { status, completed_at: status === 'completed' ? new Date().toISOString() : null },
    'Sayım durumunu elle değiştirme',
  )
}

/**
 * Bir sayımı (ve stock_count_items'daki tüm kalemlerini, ON DELETE CASCADE ile)
 * tamamen siler — kullanıcı isteği, 2026-08-27: yanlışlıkla ileri tarihe
 * açılmış/kalmış sayımları temizleyebilmek için. TAMAMLANMIŞ bir sayımı
 * silmek, o sayımın tamamlanırken zaten uyguladığı stok hareketlerini GERİ
 * ALMAZ — sadece sayım kaydının kendisi kaybolur (UI tarafında bu ayrım
 * kullanıcıya açıkça gösteriliyor, bkz. DailyCountPanel.tsx).
 */
export async function deleteStockCount(stockCountId: string): Promise<void> {
  await offlineDelete('stock_counts', stockCountId, 'Sayım silme')
}
