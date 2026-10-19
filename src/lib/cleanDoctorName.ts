import { lookupLocationWord, trFold, type DetectedLocation } from './detectProvince'

/**
 * Cari adlarını sadeleştirir (kullanıcı isteği, 2026-10-19: "Dr. Ahmet Yılmaz
 * gibi olsun, arada bölge yazmasın — Dr.Antep Deniz Demir değil, sadece
 * Dr. Deniz Demir"):
 *  - unvanlar başa ve standart yazıma alınır: "DR", "dr.", "Dr.Ahmet" → "Dr. Ahmet";
 *    "Uzm. Dr.", "Op. Dr.", "Prof. Dr.", "Doç. Dr.", "Dt." korunur
 *  - isimdeki il / ilçe adı çıkarılır — kişi adını bozmamak için temkinli:
 *      · unvandan ÖNCE yazılan her şey konum/kurum sayılır ("Adana Eğitim Dr. X" → "Dr. X")
 *      · unvandan hemen sonra gelen il ("Dr. Antep Deniz Demir"), ya da unvansız
 *        isimde baştaki il, ancak geriye en az ad + soyad kalıyorsa çıkarılır
 *      · sondaki il / semt çıkarılır ("Dr. Melis Ersoz Bursa", "Özge Hoca İzmir",
 *        "… Şahsi Adana") ama soyadı da olabilen yer adları korunur ("Dr. Onur Sivas")
 *      · "Eğitim", "Şahsi" gibi konumla yazılmış kurum/not kelimeleri de çıkarılır
 *      · kişi adı olarak da kullanılan iller (Aydın, Tokat, Ordu, Van, Muş)
 *        sadece unvandan önce yazılmışsa çıkarılır
 *  - ad(lar) "Deniz", soyadı (son kelime) tamamen büyük: "Dr. Deniz DEMİR";
 *    büyük harfli "I"nın ı mı i mi olduğu `buildSpellingDictionary` sözlüğünden bulunur
 *  - bitişik yazılmış ad + soyadı ayrılır ("Birgültopçuoğlu" → "Birgül TOPÇUOĞLU")
 * Çıkarılan il/ilçe `location` olarak, unvandan önceki konum dışı kelimeler
 * (ör. "Eğitim") `prefix` olarak döner — çağıran İl / Hastane alanına yazabilir.
 * Harf içermeyen adlara (ör. sadece telefon numarası) dokunulmaz.
 */

const TITLES: Record<string, string> = {
  prof: 'Prof.',
  doc: 'Doç.',
  'doç': 'Doç.',
  uzm: 'Uzm.',
  op: 'Op.',
  dr: 'Dr.',
  // sık yapılan yazım hataları
  drv: 'Dr.',
  drg: 'Dr.',
  dt: 'Dt.',
  ecz: 'Ecz.',
}
const TITLE_ORDER = ['Prof.', 'Doç.', 'Uzm.', 'Op.', 'Dr.', 'Dt.', 'Ecz.']
const HONORIFICS = new Set(['hoca', 'hocam', 'hanim', 'hanım', 'hn', 'hnm', 'bey', 'abi', 'abla'])
const HONORIFIC_SPELLING: Record<string, string> = { hoca: 'Hoca', hocam: 'Hocam', hanim: 'Hanım', hn: 'Hanım', hnm: 'Hanım', bey: 'Bey', abi: 'Abi', abla: 'Abla' }
/**
 * Konumla birlikte yazılan kurum kelimeleri ("Adana Eğitim" = Adana Eğitim ve
 * Araştırma Hastanesi). Sadece bir il/ilçenin hemen ardından gelirse çıkarılır
 * — "Devlet", "Şehir" kişi adı da olabildiği için tek başına dokunulmaz.
 */
const INSTITUTION_WORDS = new Set(['egitim', 'eah', 'devlet', 'sehir', 'hastane', 'hastanesi', 'universite', 'universitesi', 'tip', 'arastirma'])
/** Ada eklenmiş "şahsi (numara)" gibi notlar — her yerde çıkarılır. */
const NOTE_WORDS = new Set(['sahsi'])
/** Etkinlik notları ("… Ahmet Hoca Workshop") — isimden çıkarılıp nota taşınır. */
const EVENT_WORDS = new Set(['workshop', 'worksop', 'webinar', 'webiner', 'kongre', 'kongresi', 'seminer', 'sempozyum'])
const HOCA = new Set(['hoca', 'hocanin', 'hocam'])
/** İş yeri adı belirten kelimeler — bu adlarda soyadı büyütülmez ("Lotus Güzellik", "Arma Klinik"). */
const BUSINESS_WORDS = new Set([
  'klinik', 'klinigi', 'clinic', 'estetik', 'aesthetic', 'aesthetics', 'guzellik', 'medikal', 'medical', 'islem',
  'merkez', 'merkezi', 'akademi', 'ajans', 'ajansi', 'beauty', 'derma', 'yenge', 'yengem', 'teyze', 'eniste',
])
/** Neredeyse hiç soyadı olmayan ikinci adlar — unvansız "Ayşe Kübra" iki adlı, soyadsız kayıttır. */
const SECOND_GIVEN_NAMES = new Set(['kubra', 'ziya', 'sude', 'nur', 'ilayda', 'ebrar', 'betul', 'zehra', 'elif', 'ayse', 'fatma', 'zeynep', 'merve', 'emine', 'hatice'])
/**
 * Soyadı olarak da yaygın il/ilçe adları — isim SONUNDA geçerse soyadı
 * sayılıp korunur ("Dr. Onur Sivas", "Dr. Türkan Karaman", "Dr. Aylin Bostancı").
 */
const SURNAME_LIKE = new Set(['sivas', 'karaman', 'kars', 'bolu', 'malatya', 'bostanci', 'mamak', 'batman', 'hatay', 'kilis', 'sinop', 'rize', 'manisa', 'tarsus', 'urla'])
const fold = (w: string) => trFold(w).replace(/[^a-z]/g, '')

function titleOf(word: string): string | null {
  return TITLES[word.toLocaleLowerCase('tr-TR').replace(/\.$/, '')] ?? null
}

function upperFirst(lower: string): string {
  // Tireli / kesme işaretli kelimelerde her parça ("Ayşe-Nur", "O'Brien")
  return lower.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('tr-TR'))
}

/** I / ı / i / İ farkını yok sayan anahtar ("ELIF", "Elif", "elıf" → "elif"). */
function dottedKey(word: string): string {
  return word.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i')
}

const TURKISH_LETTER = /[çğöşüÇĞÖŞÜıİ]/

/**
 * Büyük harfle yazılmış "I" Türkçede hem ı hem i olabiliyor ("YILMAZ" → Yılmaz,
 * "ELIF" → Elif). Doğru yazımı bulmak için tüm carilerdeki düzgün yazılmış
 * (küçük harf içeren ya da İ/ı ile yazılmış) kelimelerden bir sözlük kurulur;
 * birkaç yaygın ad/soyadı da baştan eklenir.
 */
export interface SpellingDictionary {
  /** dottedKey → doğru yazım ("elif" → "Elif") */
  spelling: Map<string, string>
  /** Bilinen adlar (trFold) — bitişik yazılmış ad+soyadı ayırmak için ("Birgültopçuoğlu") */
  firstNames: Set<string>
  /** Ayrı kelime olarak geçen her kelime (trFold) → kaç kez */
  wordCounts: Map<string, number>
  /** trFold → Türkçe karakterli doğru yazım ("yildiz" → "Yıldız", "ozcan" → "Özcan") */
  turkish: Map<string, string>
}

const SEED_SPELLINGS = [
  'Yılmaz', 'Yıldız', 'Yıldırım', 'Kılıç', 'Kılınç', 'Aydın', 'Altın', 'Altıntaş', 'Akın', 'Aslı', 'Işıl', 'Ilgın',
  'Nazlı', 'Sarı', 'Çakır', 'Arıkan', 'Yazıcı', 'Kırmızı', 'Karadağ', 'Kızıl', 'Çelik', 'Şahin', 'Demir', 'Aydemir',
  'Demirci', 'Demircan', 'Elif', 'Emine', 'Fatih', 'İbrahim', 'İsmail', 'İrem', 'İlknur', 'İpek', 'İlker', 'İlhan',
  'Sibel', 'Nihal', 'Neslihan', 'Cihan', 'Cengiz', 'Hüseyin', 'Emin', 'Ali', 'Rabia', 'Dilara', 'Nergiz', 'Merve',
  'Mehmet', 'Hakan', 'Sevim', 'Kadriye', 'Halim', 'Hamdi', 'Gizem', 'Nilgün', 'Didem', 'Pınar', 'Gül', 'Tülin',
  'Şirin', 'Sinan', 'Serdar', 'Murat', 'Esin', 'Ezgi', 'Bilge', 'Bilgin', 'Bilgiç', 'Kaplan', 'Yiğit', 'Narin',
]

/**
 * Türkçe harfi sık yanlış yazılan ad/soyadlar (kullanıcı isteği, 2026-10-19:
 * "hatiçe yazan yere hatice yaz, s yada ş gibi düzenlenmesi gerekenleri düzelt").
 * trFold ile eşleşir — "HATİÇE", "Hatice", "hatıce" hepsi → "Hatice".
 * "-oglu" ile biten soyadları ayrıca her zaman "-oğlu" yapılır.
 */
const NAME_FIXES = new Map(
  [
    'Hatice', 'Süleyman', 'Zuhal', 'Züleyha', 'Çağrı', 'Çağlayan', 'Çağatay', 'Doğan', 'Doğukan', 'Uğur', 'Tuğba',
    'Tuğçe', 'Tuğrul', 'Yağmur', 'Oğuz', 'Oğuzhan', 'Güler', 'Güney', 'Güven', 'Gülsüm', 'Gülten', 'Gürbüz', 'Gözde',
    'Gökçe', 'Gökhan', 'Gökçek', 'Ömer', 'Özgür', 'Ömür', 'Ümran', 'Ümit', 'Ünal', 'Yücel', 'Nüket', 'Neşe', 'Şule',
    'Şükran', 'Şükrü', 'Şenol', 'Şakir', 'Selçuk', 'Küçük', 'Coşkun', 'Çelik', 'Doğru', 'Erdoğan', 'Erdoğdu',
    'Aydoğdu', 'Aydoğan', 'Gündoğdu', 'Karadağ', 'Alacadağ', 'Aladağ', 'Yeşildağ', 'Boğaz', 'Yavaş', 'Bütün',
    'Özkur', 'Öztürk', 'Özcan', 'Özdemir', 'Öcal', 'Başer', 'Baştürk', 'Baştuğ', 'Ertuğrul', 'Abdurrahman',
    'Ercüment', 'Cahit', 'Türkmen', 'Rümeysa', 'Begüm', 'Muratlı', 'Haspolatlı', 'Akyıldız', 'Bıçakçı', 'Eyüp',
    'Tokgöz', 'Keçebaş', 'Köroğlu', 'Koçoğlu', 'Bozdoğan', 'Karabağlı', 'Karaağaç', 'Elgörmüş', 'Sakız', 'Saraç',
    'Şahin', 'Ekici', 'Bilici', 'Yorgancılar', 'Dinçer', 'Hasçiçek', 'Akçiçek', 'Erdemli', 'Demirkaya', 'Demirtaş',
    'Nazlı', 'Işık', 'Kılıç', 'Kılıçaslan', 'Yıldız', 'Yıldırım', 'Yıldıray', 'Yılmaz', 'Güngör', 'Gürsoy', 'Gülhum',
    'Ayça', 'Cihan', 'Mürvet', 'Sabire', 'Kadriye', 'Levent', 'Bülent', 'Gülşen', 'Söylemez',
  ].map((w) => [trFold(w), w] as const),
)

function fixSpelling(word: string): string | null {
  return NAME_FIXES.get(fold(word)) ?? null
}

/** "Kurtoglu" → "Kurtoğlu", "KURTOGLU" → "KURTOĞLU" (harfler düzeltildikten sonra). */
function fixOglu(word: string): string {
  if (!/oglu$/iu.test(word) || word.length <= 5) return word
  return word.slice(0, -4) + (word.slice(-4) === word.slice(-4).toLocaleUpperCase('tr-TR') ? 'OĞLU' : 'oğlu')
}

/** Yaygın adlar — veride az geçse de bitişik yazımda tanınsın diye. */
const SEED_FIRST_NAMES = [
  'Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hasan', 'Hüseyin', 'İbrahim', 'İsmail', 'Osman', 'Yusuf', 'Murat', 'Ömer',
  'Emre', 'Burak', 'Can', 'Cem', 'Kemal', 'Kerem', 'Serkan', 'Hakan', 'Onur', 'Emin', 'Erkan', 'Ercan', 'Volkan',
  'Tolga', 'Tuncay', 'Barış', 'Bora', 'Selim', 'Selçuk', 'Sinan', 'Levent', 'Mert', 'Halil', 'Recep', 'Ramazan',
  'Ayşe', 'Fatma', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Merve', 'Esra', 'Büşra', 'Ayşegül', 'Birgül', 'Gül',
  'Özge', 'Özlem', 'Derya', 'Deniz', 'Dilek', 'Ebru', 'Burcu', 'Gamze', 'Pınar', 'Sibel', 'Seda', 'Selin', 'Sevgi',
  'Nur', 'Nurcan', 'Nuray', 'Hülya', 'Hande', 'Gözde', 'Tuğba', 'Tuba', 'Yasemin', 'Melek', 'Meltem', 'Canan',
  'Filiz', 'Funda', 'Gizem', 'İrem', 'Aslı', 'Aylin', 'Banu', 'Berna', 'Betül', 'Ceren', 'Didem', 'Duygu', 'Ece',
  'Eda', 'Ezgi', 'Gonca', 'Hilal', 'Kübra', 'Leyla', 'Nihal', 'Nazlı', 'Neslihan', 'Rabia', 'Sena', 'Serap', 'Şule',
]

export function buildSpellingDictionary(names: string[]): SpellingDictionary {
  const counts = new Map<string, Map<string, number>>()
  const add = (form: string, n = 1) => {
    const key = dottedKey(form)
    const forms = counts.get(key) ?? new Map<string, number>()
    forms.set(form, (forms.get(form) ?? 0) + n)
    counts.set(key, forms)
  }
  const turkishCounts = new Map<string, Map<string, number>>()
  const addTurkish = (form: string, n: number) => {
    const key = fold(form)
    const forms = turkishCounts.get(key) ?? new Map<string, number>()
    forms.set(form, (forms.get(form) ?? 0) + n)
    turkishCounts.set(key, forms)
  }
  for (const w of SEED_SPELLINGS) {
    add(w, 2)
    if (TURKISH_LETTER.test(w)) addTurkish(w, 2)
  }
  for (const name of names) {
    // Türkçe klavyesiz yazılmış isimlerdeki kelimeler ("Yildiz") zayıf kanıt
    const asciiName = !TURKISH_LETTER.test(name)
    for (const w of name.split(/[\s.]+/)) {
      if (!/^\p{L}[\p{L}'’-]*$/u.test(w) || w.length < 2) continue
      // Sadece yazımı belli olan kelimeler: küçük harf içeren ya da İ/ı geçen
      const unambiguous = w !== w.toLocaleUpperCase('tr-TR') || /[İı]/.test(w)
      if (!unambiguous) continue
      const form = upperFirst(w.toLocaleLowerCase('tr-TR'))
      add(form, asciiName ? 0.3 : 1)
      if (TURKISH_LETTER.test(form)) addTurkish(form, 1)
    }
  }
  const turkish = new Map<string, string>()
  for (const [key, forms] of turkishCounts) turkish.set(key, [...forms].sort((a, b) => b[1] - a[1])[0][0])
  const spelling = new Map<string, string>()
  for (const [key, forms] of counts) spelling.set(key, [...forms].sort((a, b) => b[1] - a[1])[0][0])

  // Ad sözlüğü: unvandan sonraki ilk kelime, en az iki ayrı kişide ad olarak geçiyorsa
  const firstCounts = new Map<string, number>()
  const wordCounts = new Map<string, number>()
  for (const name of names) {
    const words = name.split(/[\s.]+/).filter((w) => /^\p{L}{2,}$/u.test(w) && !titleOf(w))
    for (const w of words) wordCounts.set(fold(w), (wordCounts.get(fold(w)) ?? 0) + 1)
    if (words.length >= 2) firstCounts.set(fold(words[0]), (firstCounts.get(fold(words[0])) ?? 0) + 1)
  }
  const firstNames = new Set(SEED_FIRST_NAMES.map(fold))
  for (const [w, n] of firstCounts) if (n >= 2 && w.length >= 3) firstNames.add(w)
  return { spelling, firstNames, wordCounts, turkish }
}

/**
 * Bitişik yazılmış ad + soyadı ayırır ("Birgültopçuoğlu" → "Birgül", "topçuoğlu";
 * "Ayşegülsatılmış" → "Ayşegül", "satılmış"). Temkinli: kelime en az 8 harf
 * olmalı, kendisi başka kayıtlarda ayrı kelime olarak geçmemeli, bilinen bir adla
 * başlamalı (en uzun eşleşme) ve kalan kısım en az 5 harf olup "oğlu" ile
 * başlamamalı ("Ercanoğlu" bölünmesin).
 */
function splitGluedName(word: string, dict?: SpellingDictionary): string[] {
  if (!dict || word.length < 8 || !/^\p{L}+$/u.test(word)) return [word]
  const key = fold(word)
  if ((dict.wordCounts.get(key) ?? 0) > 1 || dict.firstNames.has(key) || key.length !== word.length) return [word]
  for (let i = key.length - 5; i >= 3; i--) {
    if (!dict.firstNames.has(key.slice(0, i))) continue
    const rest = key.slice(i)
    if (rest.startsWith('oglu')) continue
    // 3 harfli adla ("Cem") ayırmak için kalan kısım bilinen bir kelime olmalı —
    // "Cemilışık" → "Cem İlışık" olmasın
    if (i === 3 && !dict.wordCounts.has(rest) && !dict.turkish.has(rest)) continue
    return [word.slice(0, i), word.slice(i)]
  }
  return [word]
}

function capitalize(word: string, nameHasTurkishLetters: boolean, dict?: SpellingDictionary): string {
  if (!/\p{L}/u.test(word)) return word
  // Türkçe klavyesiz yazılmış isimde ("Yildiz", "OZCAN") bilinen Türkçe yazım varsa onu kullan
  if (!nameHasTurkishLetters) {
    const turkish = dict?.turkish.get(fold(word))
    if (turkish) return turkish
  }
  // Zaten küçük harf içeriyorsa yazana güven, sadece ilk harfi büyüt
  if (word !== word.toLocaleUpperCase('tr-TR')) return upperFirst(word.charAt(0).toLocaleLowerCase('tr-TR') + word.slice(1))
  if (/I/.test(word) && !/[İı]/.test(word)) {
    const key = dottedKey(word)
    const known = dict?.spelling.get(key)
    if (known) return known
    // Birleşik soyadı: "SARIAYDIN" = Sarı + aydın
    if (dict) {
      for (let i = 2; i <= key.length - 2; i++) {
        const head = dict.spelling.get(key.slice(0, i))
        const tail = dict.spelling.get(key.slice(i))
        if (head && tail) return head + tail.toLocaleLowerCase('tr-TR')
      }
    }
    // Türkçe klavyesiz yazılmış isimde (Ç/Ş/Ü… hiç yok) "I" çoğunlukla "i"dir
    if (!nameHasTurkishLetters) return upperFirst(word.replace(/I/g, 'i').toLocaleLowerCase('tr-TR'))
  }
  return upperFirst(word.toLocaleLowerCase('tr-TR'))
}

export interface CleanedName {
  name: string
  location: DetectedLocation | null
  /** Konumla yazılmış kurum ("Eğitim") — Hastane alanına */
  prefix: string | null
  /** İsimden çıkarılan not ("Ahmet Hoca Workshop", parantez içi) — Not alanına */
  note: string | null
}

export function cleanDoctorName(raw: string, dict?: SpellingDictionary): CleanedName {
  const original = raw.trim()
  if (!/\p{L}/u.test(original)) return { name: original, location: null, prefix: null, note: null }
  // Kullanıcı adı / kod gibi rakam içeren tek kelimelik adlara dokunma ("bilginyunus72")
  if (/^\S*\d\S*$/u.test(original)) return { name: original, location: null, prefix: null, note: null }

  const noteParts: string[] = []
  // Parantez içi ("Burak Bey (Erol Koç Kongre)") nota
  const withoutParens = original.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    if (inner.trim()) noteParts.push(inner.trim())
    return ' '
  })
  // "Dr.Ahmet" / "Prof.Dr.Ayşe" gibi bitişik unvanları ayır
  const spaced = withoutParens.replace(/\b(prof|do[cç]|uzm|op|dr|dt|ecz)\.(?=\S)/giu, '$1. ')
  // "ADANAHümeyra" gibi büyük harfli il adı bir sonraki kelimeye bitişmişse ayır
  const splitWord = (w: string): string[] => {
    const m = /^(\p{Lu}{3,})(\p{Lu}\p{Ll}+)$/u.exec(w)
    if (m && lookupLocationWord(m[1], true)) return [m[1], ...splitWord(m[2])]
    // "İremSamsun", "OnurKocaeli" — küçük harften sonra büyük harfle başlayan ikinci kelime
    const camel = /^(\p{Lu}\p{Ll}{2,})(\p{Lu}\p{Ll}{2,})$/u.exec(w)
    if (camel) return [camel[1], ...splitWord(camel[2])]
    // "DrAhmet" / "DRANKARA" — unvan sonraki kelimeye bitişik
    const t = /^(dr)(\p{L}{3,})$/iu.exec(w)
    // ("DRNABİYE" gibi tamamı büyük harfli bitişik yazım da — Türkçede "dr" ile başlayan ad yok)
    if (t && (/^\p{Lu}\p{Ll}/u.test(t[2]) || lookupLocationWord(t[2], true) || (w === w.toLocaleUpperCase('tr-TR') && t[2].length >= 4)))
      return [t[1], ...splitWord(t[2])]
    return [w]
  }
  const words = spaced.split(/\s+/).filter(Boolean).flatMap(splitWord)

  const titles: string[] = []
  const firstTitleIdx = words.findIndex((w) => titleOf(w))
  let location: DetectedLocation | null = null
  const prefixWords: string[] = []
  const take = (loc: DetectedLocation | null) => {
    if (loc && (!location || (!location.district && loc.district && loc.province === location.province))) location = loc
  }

  // 1) Unvandan önceki kelimeler: konum ise çıkar, değilse kurum (prefix)
  let rest = words
  if (firstTitleIdx > 0) {
    const before = words.slice(0, firstTitleIdx)
    // Unvandan önce kurum değil de not varsa ("Ahmet Hoca Workshop İstanbul Dr. …") nota
    const isNote = before.some((w) => EVENT_WORDS.has(fold(w)) || HOCA.has(fold(w)))
    const notePrefix: string[] = []
    for (const w of before) {
      const loc = lookupLocationWord(w, true)
      if (loc) take(loc)
      else if (isNote) notePrefix.push(w)
      else prefixWords.push(w)
    }
    if (notePrefix.length > 0) noteParts.push(notePrefix.join(' '))
    rest = words.slice(firstTitleIdx)
  }

  // 2) Unvanları topla (isim içinde dağınık olsalar da)
  const nameWords: string[] = []
  for (const w of rest) {
    const t = titleOf(w)
    if (t) {
      if (!titles.includes(t)) titles.push(t)
    } else nameWords.push(w)
  }

  // 3) Baştaki il/ilçe (unvandan sonra ya da unvansız isimde) — geriye ad + soyad kalmalı
  // Unvan varsa ve kelime bir İL ise geriye tek ad kalsa da çıkarılır ("Dr. Ankara Dilek")
  while (nameWords.length > 2 || (nameWords.length === 2 && titles.length > 0 && lookupLocationWord(nameWords[0]) && !lookupLocationWord(nameWords[0])!.district)) {
    const loc = lookupLocationWord(nameWords[0])
    if (!loc) break
    take(loc)
    nameWords.shift()
    while (nameWords.length > 2 && INSTITUTION_WORDS.has(fold(nameWords[0]))) prefixWords.push(nameWords.shift()!)
  }

  // İsimden sonra yazılmış etkinlik notu ("Dr. Ayşegül Okur Ahmet Hoca Workshop") —
  // en az ad + soyad kaldıktan sonraki "X Hoca" ya da etkinlik kelimesinden itibaren nota
  {
    let cut = -1
    nameWords.forEach((w, i) => {
      const f = fold(w)
      const start = HOCA.has(f) ? i - 1 : EVENT_WORDS.has(f) ? i : -1
      if (start >= 2 && (cut < 0 || start < cut)) cut = start
    })
    if (cut >= 2) {
      noteParts.push(nameWords.slice(cut).join(' '))
      nameWords.splice(cut)
    }
  }

  // Sona yazılmış konum + kurum ("Dr. Hasan Aydemir Adana Eğitim")
  for (let i = nameWords.length - 2; i >= 2; i--) {
    const loc = lookupLocationWord(nameWords[i], true)
    const tail = nameWords.slice(i + 1)
    if (loc && tail.length > 0 && tail.every((w) => INSTITUTION_WORDS.has(fold(w)))) {
      take(loc)
      prefixWords.push(...tail)
      nameWords.splice(i)
      break
    }
  }


  // 4) Sondaki il — sadece hitap ya da "Şahsi" notundan sonra ("Özge Hoca İzmir", "… Şahsi Adana")
  const beforeLast = nameWords.length >= 3 ? nameWords[nameWords.length - 2] : ''
  if (beforeLast && (HONORIFICS.has(beforeLast.toLocaleLowerCase('tr-TR')) || NOTE_WORDS.has(fold(beforeLast)))) {
    const loc = lookupLocationWord(nameWords[nameWords.length - 1])
    if (loc) {
      take(loc)
      nameWords.pop()
    }
  }

  // 5) Sona yazılmış il / semt ("Dr. Melis Ersoz Bursa", "… Muğla Marmaris",
  //    "… Nişantaşı Klinik" hariç) — soyadı olabilecekler (SURNAME_LIKE) korunur,
  //    geriye en az bir ad kalmalı (unvansızsa ad + soyad)
  while (nameWords.length > (titles.length > 0 ? 1 : 2)) {
    const last = nameWords[nameWords.length - 1]
    const loc = lookupLocationWord(last)
    if (!loc || SURNAME_LIKE.has(fold(last))) break
    take(loc)
    nameWords.pop()
  }

  // "Şahsi" gibi not kelimeleri
  for (let i = nameWords.length - 1; i >= 0 && nameWords.length > 1; i--) if (NOTE_WORDS.has(fold(nameWords[i]))) nameWords.splice(i, 1)

  // Unvandan önce sadece konum/kurum vardı ama isim kalmadıysa hiçbir şeyi bozma
  if (nameWords.length === 0) return { name: original, location: null, prefix: null, note: null }

  // Bitişik ad+soyadı ayır — sadece ilk kelimede (ad soyada yapışmışsa)
  nameWords.splice(0, 1, ...splitGluedName(nameWords[0], dict))

  titles.sort((a, b) => TITLE_ORDER.indexOf(a) - TITLE_ORDER.indexOf(b))
  const tr = TURKISH_LETTER.test(original)
  const cap = (w: string) => capitalize(w, tr, dict)
  // Ad(lar) "Ahmet", soyadı (son kelime) tamamen büyük: "Dr. Ahmet YILMAZ"
  // (kullanıcı isteği, 2026-10-19). Soyadı yazıldığı haliyle büyütülür —
  // küçültüp büyütmek "YILMAZ"ı "YİLMAZ" yapabilirdi.
  // "Hanım / Bey / Hoca" geçiyorsa soyadı yok sayılır ("Yıldız Hanım", "Mehmet Bey Zeplin")
  const endsWithHonorific = nameWords.some((w, i) => i > 0 && HONORIFICS.has(fold(w)))
  // Soyadı büyütülmez: iş yeri adıysa ya da unvansız isimde son kelime soyadı
  // olmayan bir ikinci adsa ("Ayşe Kübra", "Mustafa Ziya")
  const lastFold = fold(nameWords[nameWords.length - 1])
  const noSurname =
    endsWithHonorific ||
    nameWords.some((w) => BUSINESS_WORDS.has(fold(w))) ||
    (titles.length === 0 && SECOND_GIVEN_NAMES.has(lastFold))
  const isSurname = (i: number) => nameWords.length >= 2 && i === nameWords.length - 1 && !noSurname
  const parts = nameWords.map((w, i) => {
    // "M.E.A." gibi baş harf kısaltmaları büyük kalır
    if (/^(\p{L}\.)+\p{L}?\.?$/u.test(w)) return w.toLocaleUpperCase('tr-TR')
    const fixed = fixSpelling(w)
    if (fixed) return isSurname(i) ? fixed.toLocaleUpperCase('tr-TR') : fixed
    if (HONORIFICS.has(fold(w))) return HONORIFIC_SPELLING[fold(w)] ?? cap(w)
    if (!isSurname(i)) return cap(w)
    if (!tr && dict?.turkish.has(fold(w))) return dict.turkish.get(fold(w))!.toLocaleUpperCase('tr-TR')
    // Büyük harfli "I" belirsizse ("AYDEMIR") sözlükteki doğru yazım kullanılır
    // ("Aydemir" → "AYDEMİR"); bilinmiyorsa yazıldığı gibi kalır
    if (w === w.toLocaleUpperCase('tr-TR') && /I/.test(w) && !/[İı]/.test(w)) return (dict?.spelling.get(dottedKey(w)) ?? w).toLocaleUpperCase('tr-TR')
    return w.toLocaleUpperCase('tr-TR')
  })
  const name = [...titles, ...parts.map(fixOglu)].join(' ')
  return {
    name,
    location,
    prefix: prefixWords.length > 0 ? prefixWords.map(cap).join(' ') : null,
    note: noteParts.length > 0 ? noteParts.join(' · ') : null,
  }
}
