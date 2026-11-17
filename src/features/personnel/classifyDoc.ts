/**
 * Özlük evrakı sayfasının türünü metinden tahmin eder (toplu PDF ayırma için). Saf fonksiyon — test edilebilir.
 * Her türün anahtar kelimeleri puanlanır; en yüksek puanlı tür seçilir. Hiçbiri tutmazsa null (önceki belgenin devamı).
 */
const RULES: { key: string; patterns: RegExp[] }[] = [
  { key: 'ehliyet', patterns: [/sürücü belgesi|surucu belgesi/, /driving licen[cs]e/, /ehliyet/] },
  { key: 'nufus_cuzdani', patterns: [/kimlik kart/, /identity card/, /nüfus cüzdan|nufus cuzdan/, /date of expiry|son geçerlilik/] },
  { key: 'nufus_kayit', patterns: [/nüfus kayıt örneği|nufus kayit ornegi/, /vukuatlı|vukuatli/, /aile kütüğü|nüfus aile kayıt/] },
  { key: 'ikametgah', patterns: [/yerleşim yeri|yerlesim yeri/, /ikametgah|ikametgâh/, /adres bilgileri|diğer adres/, /yerleşim yeri ve diğer adres belgesi/] },
  { key: 'adli_sicil', patterns: [/adli sicil/, /sabıka|sabika/, /arşiv kaydı|arsiv kaydi/] },
  { key: 'diploma', patterns: [/diploma/, /mezuniyet/, /fakülte|fakulte|üniversite|universite/, /lisans|önlisans|lise /] },
  { key: 'saglik_raporu', patterns: [/sağlık raporu|saglik raporu/, /çalışmasına engel|calismasina engel|çalışabilir/, /işe giriş muayene|ise giris muayene|periyodik muayene/, /hekim/] },
  { key: 'is_sozlesmesi', patterns: [/iş sözleşmesi|is sozlesmesi/, /belirsiz süreli|belirli süreli/, /işveren/, /madde \d/] },
  { key: 'sgk_giris', patterns: [/işe giriş bildirgesi|ise giris bildirgesi/, /sigortalı|sigortali/, /sosyal güvenlik kurumu|sgk/, /işyeri sicil/] },
  { key: 'askerlik', patterns: [/askerlik/, /askeralma|asker alma/, /terhis/, /muaf|tecil|yoklama kaçağı/] },
  { key: 'aile_durum', patterns: [/aile durum/, /eşinin|esinin|eş durumu/, /çocuk sayısı|cocuk sayisi/, /asgari geçim/] },
  { key: 'banka', patterns: [/\biban\b/, /hesap no|hesap numarası/, /\btr\d{2}\s?\d{4}/] },
  { key: 'kvkk', patterns: [/kişisel verilerin korunması|kisisel verilerin korunmasi/, /\bkvkk\b/, /açık rıza|acik riza/, /aydınlatma metni/] },
  { key: 'isg_egitim', patterns: [/iş sağlığı ve güvenliği|is sagligi ve guvenligi/, /\bisg\b/, /temel eğitim|eğitim katılım|katılım belgesi/] },
  { key: 'cv', patterns: [/özgeçmiş|ozgecmis/, /curriculum vitae|\bcv\b/, /iş deneyimi|is deneyimi|deneyimler/, /referanslar/] },
]

export function classifyDocText(text: string): string | null {
  const t = text.toLocaleLowerCase('tr-TR')
  let best: string | null = null
  let bestScore = 0
  for (const rule of RULES) {
    // İlk desen türün adıdır, daha ağır sayılır
    const score = rule.patterns.reduce((s, p, i) => s + (p.test(t) ? (i === 0 ? 3 : 1) : 0), 0)
    if (score > bestScore) {
      best = rule.key
      bestScore = score
    }
  }
  return bestScore >= 2 ? best : null
}
