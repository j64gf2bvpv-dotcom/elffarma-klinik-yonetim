import { turkeyProvinces } from './turkeyProvinces'

/**
 * Serbest metinden (kişi adı, kurum, adres, not) Türkiye ilini ve — eşleşme
 * bir ilçe/semtse — ilçeyi tahmin eder. Kullanıcı istekleri, 2026-10-01:
 * "rehberde bölge ismi yazan kısımlardakileri illere ekle", "isimlerin
 * başında ya da içinde geçen bölge varsa bölgelere ekle"
 * (ör. "Özge Hoca İzmir" → İzmir, "Kadıköy Dr. Ece" → İstanbul / Kadıköy).
 *
 * - Büyük/küçük harf ve Türkçe karakter farkı önemsiz ("IZMIR", "izmir'den").
 * - Yaygın kısa adlar (Antep, Urfa, Maraş, Afyon, İçel) ilgili ile çevrilir.
 * - Kişi adı olarak da çok kullanılan iller (Aydın, Tokat, Ordu, Van, Muş)
 *   KİŞİ ADINDA aranmaz — "Dr. Aydın Yılmaz" Aydın'a yazılmasın diye; bu
 *   iller sadece kurum/adres/notta geçerse alınır. Aynı sebeple isim olarak
 *   da kullanılan ilçeler (Fatih, Levent, Kartal, Seyhan, Nilüfer, Lara,
 *   Eyüp, Karatay, Meram, Erdemli, Polatlı) listeye hiç alınmadı.
 * - Öncelik: adres > kurum > kişi adı > not. Kişi adında İLK eşleşme alınır —
 *   rehberde il genelde başa yazılıyor ("DR ZONGULDAK GÖZDE …"); sondaki
 *   eşleşmeyi almak "DR GAZIANTEP ONUR SIVAS" gibi soyadlarını il sanıyordu.
 *   İl sona yazılmışsa ("Özge Hoca İzmir") başka eşleşme olmadığı için yine bulunur.
 */

export function trFold(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/i̇/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
}

const AMBIGUOUS_IN_NAME = new Set(['aydin', 'tokat', 'ordu', 'van', 'mus'])

const ALIASES: Record<string, string> = {
  antep: 'Gaziantep',
  urfa: 'Şanlıurfa',
  maras: 'Kahramanmaraş',
  afyon: 'Afyonkarahisar',
  icel: 'Mersin',
}

const DISTRICTS: Record<string, string[]> = {
  İstanbul: [
    'Kadıköy', 'Beşiktaş', 'Şişli', 'Bakırköy', 'Ataşehir', 'Üsküdar', 'Maltepe', 'Pendik', 'Ümraniye',
    'Beylikdüzü', 'Esenyurt', 'Avcılar', 'Bahçelievler', 'Başakşehir', 'Beyoğlu', 'Sarıyer', 'Beykoz',
    'Çekmeköy', 'Sancaktepe', 'Sultanbeyli', 'Tuzla', 'Zeytinburnu', 'Bağcılar', 'Güngören', 'Eyüpsultan',
    'Kağıthane', 'Nişantaşı', 'Etiler', 'Florya', 'Bostancı', 'Suadiye', 'Caddebostan', 'Mecidiyeköy',
    'Büyükçekmece', 'Silivri', 'Çatalca', 'Kurtköy', 'Taksim',
  ],
  Ankara: ['Çankaya', 'Keçiören', 'Yenimahalle', 'Etimesgut', 'Sincan', 'Mamak', 'Gölbaşı', 'Kızılay', 'Ümitköy', 'Çayyolu', 'Batıkent'],
  İzmir: ['Karşıyaka', 'Bornova', 'Buca', 'Konak', 'Çiğli', 'Bayraklı', 'Alsancak', 'Gaziemir', 'Karabağlar', 'Narlıdere', 'Balçova', 'Urla', 'Çeşme', 'Menemen', 'Torbalı', 'Seferihisar'],
  Antalya: ['Muratpaşa', 'Konyaaltı', 'Kepez', 'Alanya', 'Manavgat', 'Serik', 'Belek'],
  Muğla: ['Bodrum', 'Fethiye', 'Marmaris', 'Milas', 'Dalaman', 'Datça', 'Ortaca', 'Köyceğiz'],
  Bursa: ['Osmangazi', 'Mudanya', 'Gemlik', 'İnegöl', 'Görükle'],
  Kocaeli: ['İzmit', 'Gebze', 'Gölcük', 'Darıca', 'Körfez'],
  Adana: ['Çukurova', 'Yüreğir'],
  Gaziantep: ['Şahinbey', 'Şehitkamil'],
  Konya: ['Selçuklu'],
  Mersin: ['Tarsus', 'Mezitli'],
  Eskişehir: ['Tepebaşı', 'Odunpazarı'],
  Kayseri: ['Melikgazi', 'Kocasinan', 'Talas'],
  Samsun: ['Atakum', 'İlkadım', 'Bafra'],
  Trabzon: ['Ortahisar', 'Akçaabat'],
  Denizli: ['Pamukkale', 'Merkezefendi'],
  Balıkesir: ['Edremit', 'Ayvalık', 'Bandırma', 'Altıeylül', 'Karesi'],
  Tekirdağ: ['Çorlu', 'Çerkezköy', 'Süleymanpaşa'],
  Sakarya: ['Adapazarı', 'Serdivan'],
  Hatay: ['Antakya', 'İskenderun'],
  Diyarbakır: ['Kayapınar'],
}

export interface DetectedLocation {
  province: string
  /** Eşleşme bir ilçe/semt adıysa (ör. "Kadıköy"), Türkçe yazımıyla */
  district: string | null
}

export type LocationSource = {
  name?: string | null
  org?: string | null
  address?: string | null
  note?: string | null
}

const LOOKUP = new Map<string, DetectedLocation>()
for (const p of turkeyProvinces) LOOKUP.set(trFold(p), { province: p, district: null })
for (const [alias, p] of Object.entries(ALIASES)) LOOKUP.set(alias, { province: p, district: null })
for (const [p, districts] of Object.entries(DISTRICTS))
  for (const d of districts) if (!LOOKUP.has(trFold(d))) LOOKUP.set(trFold(d), { province: p, district: d })

function tokens(text: string): string[] {
  return trFold(text)
    .split(/[^a-z]+/)
    .filter(Boolean)
}

function findIn(
  text: string | null | undefined,
  { skipAmbiguous, preferLast }: { skipAmbiguous: boolean; preferLast: boolean },
): DetectedLocation | null {
  if (!text) return null
  const list = tokens(text)
  const ordered = preferLast ? [...list].reverse() : list
  const hits: DetectedLocation[] = []
  for (const t of ordered) {
    if (skipAmbiguous && AMBIGUOUS_IN_NAME.has(t)) continue
    const hit = LOOKUP.get(t)
    if (hit) hits.push(hit)
  }
  const first = hits[0]
  if (!first) return null
  // İl adı önce, ilçe sonra yazılmışsa ("İSTANBUL Filiz Kurt Ataşehir",
  // "Muğla Marmaris") ilçeyi de ekle — sadece AYNI ilin ilçesiyse.
  if (!first.district) {
    const district = hits.find((h) => h.district && h.province === first.province)
    if (district) return district
  }
  return first
}

/** İl + (eşleşme ilçeyse) ilçe. */
export function detectLocation(source: LocationSource): DetectedLocation | null {
  return (
    findIn(source.address, { skipAmbiguous: false, preferLast: true }) ??
    findIn(source.org, { skipAmbiguous: false, preferLast: true }) ??
    findIn(source.name, { skipAmbiguous: true, preferLast: false }) ??
    findIn(source.note, { skipAmbiguous: true, preferLast: false })
  )
}

export function detectProvince(source: LocationSource): string | null {
  return detectLocation(source)?.province ?? null
}
