# Analiz Raporu — Elffarma Klinik Yönetim

Bu rapor, projede hiçbir dosya değiştirilmeden yapılan bir kod tabanı,
bağımlılık ve mimari analizinin sonucudur.

## 1. Proje gerçekte CLAUDE.md'de anlatılandan çok daha geniş

`CLAUDE.md`, projeyi "müşteri/stok/tahsilat/randevu" MVP'si olarak tarif ediyor
ama gerçek kod tabanında **v1.5.0'a kadar** gelişmiş, canlıda kullanılan bir ERP
var (bkz. `CHANGELOG.md`, `DESIGN_SYSTEM.md` — bu iki dosya güncel ve doğru):

- Doktorlar (Şahıs/Hastane, fatura bilgileri, cari hesap/ödeme vadesi)
- Stok (kategori, barkod, SKT, kritik stok, hareket defteri)
- Tahsilatlar + fatura eki
- Kongreler (katılımcı, ürün dağıtımı, paket fiyatları, stoktan otomatik düşüm)
- Satışlar (satış/iade, Raporlar ve Faturalar bu sayfanın sekmeleri haline gelmiş)
- Satış Temsilcisi performans paneli
- Giderler, Bütçe Yılı
- Doktor Ziyaretleri, Hatırlatmalar (bildirim merkezi), Ajanda (FullCalendar)
- Panel: Türkiye satış haritası, döviz kuru, çeyrek/ay bazlı istatistikler
- Ayarlar: 9 marka rengi + Siyah/Gold varsayılan tema, 3 ikon seti, koyu/açık mod
- Excel/Word/PDF dışa aktarım (Türkçe karakter destekli)
- Deep-link (`elffarmapaket://`) ile şifre sıfırlama, Electron paketleme (dmg/exe) hazır

**Sonuç:** `CLAUDE.md` mimari referans olarak **güncel değil** — yeni modül
eklerken oradaki "sadece customers/stock/payments/appointments var"
varsayımıyla hareket etmek yanlış yönlendirir. `DESIGN_SYSTEM.md` yeni sayfa
eklerken asıl referans olmalı.

`ComingSoonPage.tsx` bileşeni artık **hiçbir yerde kullanılmıyor** (tüm taslak
modüller gerçek modüllere dönüştürülmüş) — güvenle silinebilecek ölü kod.

## 2. Veritabanı şeması — en kritik bulgu (bu rapordan sonra çözüldü)

`supabase/schema.sql`, CLAUDE.md'nin "tek doğruluk kaynağı, tamamı SQL
Editor'e yapıştırılır" dediği dosya, analiz sırasında sadece **10 tablo**
içeriyordu (customers, products, stock_movements, payments, appointments,
staff, whatsapp_templates, congresses, congress_participants,
congress_participant_products).

**12 tablo yalnızca dağınık ek SQL dosyalarında** bulundu ve `schema.sql`'e
hiç geri işlenmemişti:
`app_settings, budget_targets, congress_remaining_products,
customer_pending_products, doctor_visits, expenses, invoices, reminders,
sales, sales_reps, stock_count_items, stock_counts`

`supabase/` klasöründe 27 SQL dosyası vardı; bunların çoğu ("tamamını SQL
Editor'e yapıştırın" talimatlı) birbiriyle örtüşüyordu
(`all_pending_migrations.sql`, `latest_batch.sql`, `new_features.sql`,
`pending_now.sql`, `batch_doctor_congress_updates.sql` gibi isimler net bir
sıralama/versiyon bilgisi taşımıyordu). Hangi dosyanın hangi Supabase
projesine, hangi sırayla uygulandığı hiçbir yerde takip edilmiyordu.

> **Güncelleme:** Bu analizden sonraki görevde `supabase/schema.sql`, tüm 27
> dosyanın birleşimi haline getirildi (22 tablo, dependency sırası korunarak).
> Artık tek bir `schema.sql` yapıştırmak tüm modülleri çalışır hale getiriyor.
> Ayrıntı için `git`/dosya geçmişindeki ilgili değişikliğe bakılabilir.

## 3. Dokümantasyon–kod tutarsızlığı: offline yazma kuyruğu

`CLAUDE.md` ve `README.md` açıkça "çevrimdışı yazma kuyruğu yok, bilinçli bir
kapsam kararı" diyor. Ama kodda gerçek bir kuyruk **mevcut**:
`src/lib/offlineQueue.ts`, `src/lib/offlineMutation.ts`,
`src/features/offline/useOfflineSync.ts` — bağlantı kesikken yapılan
insert/update/delete/upsert/rpc işlemlerini kuyruğa alıp bağlantı gelince
sırayla gönderiyor. Bu, iki temel dokümanın **yanlış bilgi** içerdiği
anlamına geliyor — CLAUDE.md güncellenmeli.

## 4. Versiyon kontrolü yok

Bu dizin bir git deposu değil (`git status` → "not a git repository").
CHANGELOG "canlı kullanımda olan ana ERP kaynak kodu" diyor ama hiçbir commit
geçmişi/geri alma noktası yok. Bir yeniden yazma/refactor girişiminde bu
risklidir — yanlış giden bir değişikliği geri almanın tek yolu manuel dosya
karşılaştırması olur.

## 5. Sağlık kontrolleri (mevcut haliyle proje çalışıyor)

- `npm run lint` (oxlint) → temiz, sadece 4 zararsız shadcn boilerplate uyarısı.
- `tsc -b --noEmit` → hata yok, tip tutarlılığı iyi durumda.
- Test paketi hâlâ yok (`*.test.ts` bulunamadı) — CLAUDE.md'de zaten
  belirtilmişti, doğrulandı.
- Electron güvenlik sınırı (`contextIsolation`, dar `preload` yüzeyi, `wa.me`
  URL doğrulaması) hâlâ doğru şekilde uygulanıyor.

## 6. Küçük gözlemler

- `src/types/database.ts` (255 satır, elle bakımlı) muhtemelen 12 eksik
  tabloyu da yansıtmıyor — schema.sql ile aynı eksiklik burada da
  tekrarlanıyor olabilir (doğrulanmadı, ayrı bir kontrol gerekir).
- `electron-builder.yml` sadece macOS arm64 + Windows x64 hedefliyor,
  uygulama imzasız (README'de zaten belirtilmiş, bilinçli bir MVP kararı).
- Node.js `~/.local/node` üzerinden geliyor, PATH'e özel ekleme gerekiyor —
  CLAUDE.md'de not edilmiş, güncel.

## Öncelik sırasına göre öneriler

1. ~~**(Yüksek)** `supabase/schema.sql`'i tüm 27 dosyanın birleşimi haline
   getirip gerçek tek-kaynak yapın.~~ **Tamamlandı.**
2. **(Yüksek)** `CLAUDE.md`'yi mevcut gerçek mimariyle (tüm modüller, offline
   kuyruk, DESIGN_SYSTEM.md'deki tema/ikon sistemi) güncelleyin.
3. **(Orta)** Bu dizini bir git deposuna çevirin (`git init` + ilk commit) —
   geri dönülemez bir refactor öncesi bu bir güvenlik ağı sağlar.
4. **(Orta)** `src/types/database.ts`'i şemadaki tablolarla senkronize edin.
5. **(Düşük)** Ölü `ComingSoonPage.tsx`'i kaldırın.
6. **(Düşük, isteğe bağlı)** Test altyapısı yok; en azından `normalizePhone`,
   `renderTemplate`, `paymentDue`, `expiry` gibi saf mantık fonksiyonları için
   birim test eklemek düşünülebilir (mimari değişikliği gerektirmez).
