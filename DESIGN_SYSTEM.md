# Elffarma Paket Programı — Tasarım Sistemi

Bu doküman, projenin resmi tasarım sistemini belgeler. Yeni sayfa/modül eklerken
buradaki bileşenler ve kurallar referans alınır; mevcut dosyalar **taşınmaz veya
yeniden adlandırılmaz** — bu doküman sadece var olan yapıyı haritalar.

## Genel kural

Yeni bir ekran gerekiyorsa, en yakın mevcut ekranın (örn. `CustomersPage.tsx`,
`StockPage.tsx`) yapısını referans al: `PageHeader` + `Card` tabanlı içerik +
`Table` veya form `Dialog`'ları. Yeni bir renk, yeni bir buton stili, yeni bir
kart görünümü **icat etme** — aşağıdaki bileşenleri kullan.

## Sayfa iskeleti (Layout)

| Parça | Dosya |
|---|---|
| Sol menü + üst kullanıcı alanı + bağlantı durumu | `src/components/layout/AppShell.tsx` → `AppShell` |
| Sayfa başlığı (başlık + açıklama + aksiyon butonları) | `src/components/layout/AppShell.tsx` → `PageHeader` |
| Korumalı rota / admin rota sarmalayıcı | `src/components/layout/ProtectedRoute.tsx` |
| Logo | `src/components/brand/ElffarmaLogo.tsx` |

`AppShell`, sabit genişlikte (`w-60`) koyu kırmızı bir sol menü (`bg-sidebar`) ve
sağda kaydırılabilir bir içerik alanından (`max-w-7xl` ortalanmış) oluşur. Her
sayfa `Outlet` içinde render olur ve genelde ilk satırda bir `PageHeader`
kullanır.

**Menü sırası sabittir** (`AppShell.tsx` içindeki `navItems`): Panel → Doktorlar
→ Stok → Tahsilatlar → Kongreler → Doktor Ziyaretleri → (admin) Ayarlar. Yeni bir
modül eklenirse bu listenin sonuna eklenir, mevcut sıra değişmez.

## Görsel dil (premium ERP güncellemesi — v1.1.0)

Temel bileşenler (Card, Table, Dialog, Popover, Dropdown, Select, Input, Textarea,
Button) Odoo 18 / ERPNext / SAP Fiori / Linear'dan ilham alan bir "premium ERP"
görünümüne yükseltildi. Bu, mevcut bileşenlerin **içindeki** class'ların
güncellenmesiyle yapıldı — bileşen API'leri, dosya adları ve kullanım şekilleri
değişmedi, dolayısıyla bu tabloyu zaten kullanan her sayfa otomatik olarak yeni
görünümü alır.

- **Cam yüzeyler (glassmorphism)**: Card/Dialog/Popover/Dropdown/Select artık
  yarı saydam arka plan + `backdrop-blur` kullanıyor (`bg-card/90 backdrop-blur-xl`
  gibi), altındaki radial arka plan parıltısıyla (`AppShell` `<main>`) birlikte
  derinlik hissi veriyor.
- **Gölge/derinlik**: Kartlar ve dialoglar çok katmanlı, yumuşak gölgeler kullanıyor
  (`inset` parlaklık + geniş/yumuşak dış gölge); kart üzerine gelince gölge
  büyüyor (`hover:shadow-...`).
- **Köşe yarıçapı ölçeği**: Buton/Input/Select/Textarea `rounded-lg`, Card/Dialog
  `rounded-xl`, Badge `rounded-md` — tutarlı bir hiyerarşi.
- **Profesyonel veri tabloları**: Tablo başlıkları artık küçük harfli değil,
  `text-xs uppercase tracking-wide` + hafif blur'lu arka plan tonuyla (Fiori/Odoo
  tarzı); satır hover'ı `accent` rengiyle daha yumuşak.
- **Sidebar cam efekti**: `AppShell` sol menüsüne üstten alta hafif bir parlaklık
  gradyanı eklendi (`pointer-events-none` katman, tıklamaları etkilemez).
- **Koyu / Açık tema**: Artık gerçek bir mod anahtarı var —
  `src/features/appSettings/useColorMode.ts` (`app_settings` içinde `color_mode`
  anahtarı, `'light' | 'dark'`) `<html>` üzerine `.dark` class'ını ekler/kaldırır.
  Sidebar alt kısmındaki güneş/ay ikonuna tıklayarak hızlıca değiştirilebilir;
  Ayarlar → Görünüm kartında da kalıcı bir seçici var. `brandThemeCssVars(hue,
  chromaScale, mode)` fonksiyonu artık `mode` parametresi alıyor ve seçilen marka
  rengini hem açık hem koyu temada doğru kontrastla üretiyor — bu yüzden marka
  rengi + koyu/açık kombinasyonları birbirini bozmuyor.

Bu görsel yükseltme artık **donmuş yeni referans**: bundan sonraki değişiklikler
bu güncellenmiş bileşenleri kullanır, tekrar eski (düz, camsız) görünüme dönülmez.

## Siyah / Gold Premium ERP güncellemesi (v1.2.0)

Kullanıcının paylaştığı referans görsele (Linear/Stripe/Notion/Framer/Vercel
ilhamlı, siyah zemin + gold vurgu, ELFFARMA lotus amblemli sidebar) göre ikinci
bir yükseltme yapıldı:

- **Yeni varsayılan tema**: `src/features/appSettings/brandThemes.ts` içinde
  `blackGoldTheme` (`id: 'black_gold'`) artık **varsayılan** — hiç tema seçilmemiş
  kurulumlarda otomatik uygulanır. Siyah (`oklch(0.13 0.004 85)` ~ #0D1117 tonu) zemin
  + gold (`oklch(0.78 0.14 85)` ~ #D4AF37) vurgu rengi kullanır. Kırmızı ve diğer 8
  renk seçeneği Ayarlar → Görünüm → Marka Rengi'nde hâlâ mevcut.
  `brandThemeCssVars(hue, chromaScale, mode, special)` fonksiyonu `special:
  'black_gold'` geldiğinde sabit bir palet döndürür (mode parametresini yok sayar —
  bu tema tasarım olarak her zaman koyu).
- **Logo**: `ElffarmaLogo`'ya `variant="premium"` eklendi — gold gradyanlı lotus
  amblemi (`Flower2` ikonu) + gold gradyan "ELFFARMA" yazısı + "MEDİKAL ESTETİK"
  alt yazısı. Sadece sidebar'da kullanılıyor; Giriş/Şifre Sıfırlama ekranlarındaki
  `onRed`/`mono` varyantlar değişmedi.
- **Sidebar**: Aktif/hover renkleri artık sabit beyaz-alfa değil, `--sidebar-accent`
  tema değişkenine bağlı (bu yüzden gold temada aktif menü öğesi gold tonunda
  vurgulanır). Alt kısımda "Destek Hattı" kartı var (`0850 474 00 35`).
- **Üst bar (TopBar)**: `AppShell` artık her sayfanın üstünde sabit bir üst bar
  render ediyor — global arama kutusu (şu an sadece görsel, gerçek arama motoru
  henüz bağlı değil), bağlantı durumu, bildirim zili (kritik stok + ödeme vadesi +
  yaklaşan kongre — gerçek veriden, `useAlertsSummary`), admin için Ayarlar
  kısayolu, ve profil avatarı (yeşil/kırmızı çevrimiçi noktası + çıkış menüsü —
  önceden sidebar altındaydı, şimdi üst barda).
- **Genişletilmiş menü**: Sol menüye şu yeni öğeler eklendi (şimdilik "yakında"
  taslak sayfalar — gerçek veri/CRUD modül modül, onay alınarak eklenecek):
  Satışlar (`/satislar`), Raporlar (`/raporlar`), Faturalar (`/faturalar`),
  Hatırlatmalar (`/hatirlatmalar`), Ajanda (`/ajanda`). Taslak sayfalar
  `src/components/layout/ComingSoonPage.tsx` ortak bileşenini kullanıyor.
  Mevcut Doktorlar (`/musteriler`) ve Doktor Ziyaretleri (`/doktor-ziyaretleri`)
  modülleri aynen çalışır durumda kaldı. (Müşteriler, Tedarikçiler, Teklifler
  ilk eklendikten sonra kullanıcı isteğiyle kaldırıldı.)
- **Panel (Dashboard)**: Üst istatistik satırı referans görseldeki 4 karta
  (Toplam Stok, Kongre Sayısı, Tahsilat Tutarı, Satış Tutarı — renkli ikon
  kutucuklu, gerçek ay-üstü-ay değişim yüzdesiyle) güncellendi; yeni "Hızlı
  Erişim" widget'ı eklendi (Stok Ekle, Ürün Listele, Kongre Ekle, Tahsilat Ekle,
  Satış Yap, Fatura Kes, Doktor Ekle, Raporla kısayolları). Mevcut widget'lar
  (tahsilat trendi, satış haritası, kongre fiyatları, eksik ürün/bakiye, ödeme
  vadesi, SKT uyarıları, düzenlenebilir panel yerleşimi) korunmuş durumda.

## Bildirim merkezi + Ajanda/Hatırlatmalar (v1.3.0)

- **Hatırlatmalar artık gerçek bir modül**: `reminders` tablosu (`supabase/reminders.sql`),
  `src/features/reminders/*` (api/hooks/form) ve `RemindersPage.tsx` — ekle/düzenle/sil/tamamlandı
  işaretle. Sayfa ayrıca "Sistem Uyarıları" bölümünde kritik stok, SKT, ödeme vadesi,
  eksik bakiye ve eksik ürün uyarılarını da gösterir — **bildirim merkezi** burası.
- **Ajanda artık gerçek bir takvim**: `AgendaPage.tsx`, zaten kurulu olan
  `@fullcalendar/react` ile aylık takvim; kongre/workshop tarihleri, doktor ödeme
  vadeleri ve hatırlatmaları tek takvimde gösterir, tıklayınca ilgili sayfaya gider.
  Not: bu takvim yalnızca **sistemde kayıtlı** kongre/workshop/hatırlatma/ödeme
  tarihlerini gösterir — sektördeki dış/genel kongre takvimini içermez (böyle bir
  veri kaynağı yok, uydurma tarih eklenmedi).
- **`useAlertsSummary`** (`src/features/alerts/useAlertsSummary.ts`): kritik stok, SKT,
  ödeme vadesi, eksik bakiye, eksik ürün, yaklaşan kongre ve bekleyen hatırlatmaları
  tek yerde toplar; hem üst bardaki bildirim zili hem de Hatırlatmalar sayfası bunu kullanır.
- **Panel (Dashboard) sadeleşti**: Kritik stok / SKT / ödeme vadesi / eksik ürün-bakiye
  uyarı kartları Panel'den kaldırıldı — hepsi artık yalnızca bildirim zilinde ve
  Hatırlatmalar sayfasında. Panel'de sadece özet istatistikler, hızlı erişim, stok
  durumu grafiği, yaklaşan kongreler (görselli), döviz kuru, tahsilat trendi, satış
  haritası ve kongre fiyatları kaldı. 4 istatistik kartı artık tıklanabilir (ilgili
  modüle gider).
- **Kongreler liste sayfası**: her kongre kartının üstünde görseli (varsa) veya nötr
  bir ikon gösterilir.

## Satışlar modülü + Ajanda/Bildirim ince ayarları (v1.4.0)

- **Satışlar artık gerçek bir modül**: `sales` tablosu (`supabase/sales.sql`,
  `type: 'sale' | 'return'`), `src/features/sales/*` (api/hooks/form) ve
  `SalesPage.tsx` — doktor, ürün, adet, birim fiyat, tarih, satış temsilcisi
  ("elden teslim eden") bilgisiyle satış veya iade kaydı oluşturulur; her kayıt
  gerçek bir stok hareketi (`record_stock_movement`) tetikler (satış → çıkış,
  iade → giriş) ve **Stok → Geçmiş** diyaloğunda Doktor + Not sütunlarıyla
  görünür (`StockHistoryDialog.tsx`). Panel'deki "Satış Tutarı" artık kongre
  satışları + bu genel satışları (iadeler eksi olarak) birlikte hesaplıyor.
- **Ajanda ve bildirimler premium temaya göre stillendirildi**: FullCalendar,
  `index.css`'teki `.fc` CSS değişkenleri üzerinden uygulamanın renk/köşe/yazı
  tipi tokenlarını kullanıyor (hem koyu hem açık hem Siyah/Gold temada otomatik
  uyumlu); takvim olayları artık ikonlu ve üstte bir renk lejantı var. Bildirim
  zili ve Hatırlatmalar sayfasındaki uyarı satırları artık renkli ikon
  kutucuklu, hover'da hafif yükselen kartlar.

## Raporlar ve Faturalar Satışlar'ın içine taşındı (v1.5.0)

Ayrı "Raporlar" ve "Faturalar" menüleri kaldırıldı — kullanıcı isteğiyle her ikisi
**Satışlar** sayfasının sekmelerine taşındı (`SalesPage.tsx`, `Tabs`: Satışlar /
Raporlar / Faturalar):
- **Raporlar sekmesi**: `sales` tablosundan türetilen, gerçek veriye dayalı en
  çok satan/iade edilen ürünler grafiği (`RevenueChart` yeniden kullanıldı),
  doktor bazlı ve satış temsilcisi bazlı net satış tabloları.
- **Faturalar sekmesi**: `invoices` tablosu (`supabase/invoices.sql`) — fatura
  numarası, doktor, tutar, tarih, not; ekle/sil, Excel/Word/PDF dışa aktarım.
  **Not**: bu, e-Fatura/BirFatura entegrasyonu değil — dahili, basit bir fatura
  kaydı. Gerçek e-Fatura kesimi için hâlâ BirFatura'nın API erişimi gerekir.

Not: Framer Motion / Zustand / Chart.js gibi ek kütüphaneler bilerek eklenmedi —
mevcut animasyon (tw-animate-css/CSS geçişleri), state (TanStack Query) ve grafik
(Recharts) altyapısı aynı ihtiyacı zaten karşılıyor; gereksiz bağımlılık riski
alınmadı.

## Renk / tema sistemi

- Kaynak: `src/index.css` (`:root` içindeki CSS değişkenleri, OKLCH renk uzayı)
  + `src/features/appSettings/brandThemes.ts` (kullanıcının Ayarlar'dan
  seçebildiği 9 marka rengi: kırmızı [varsayılan], mavi, gök mavisi, turkuaz,
  yeşil, mor, pembe, amber, beyaz/nötr).
- `brandThemeCssVars(hue, chromaScale)` seçilen tona göre tüm `--primary`,
  `--sidebar`, `--accent` vb. değişkenleri OKLCH formülüyle üretir; uygulanışı
  `src/features/appSettings/useApplyBrandTheme.ts` içinde, `app_settings` tablosundan
  okunan `brand_theme` ayarına göre.
- Durum renkleri: `--success` (yeşil), `--warning` (amber), `--destructive`
  (kırmızı) — Badge/uyarı bileşenlerinde kullanılır, marka renginden bağımsızdır.
- Yanıp sönen bildirim rozetleri her zaman **kırmızı** (`animate-alert-glow-red`,
  tanımı `src/index.css` `@layer utilities` içinde) — amber/iki tonlu versiyon
  kaldırıldı, tutarlılık için tek renk kullanılıyor.
- `.dark` sınıfı için tam bir koyu tema tanımı `src/index.css` içinde zaten
  mevcut (şablon kalıntısı) ama şu an hiçbir yerde aktif edilmiyor/anahtarlanmıyor.

Yeni bir tema/renk **eklenmeyecek** — mevcut 9 marka rengi ve durum renkleri
yeterli kabul edilir.

## Yazı tipi

`--font-sans: 'Inter', system-ui, 'Segoe UI', Roboto, sans-serif;` (`src/index.css`).
Türkçe karakterli PDF çıktılarında ayrıca Noto Sans gömülü fontu kullanılıyor
(`src/lib/notoSansBase64.ts`, `exportData.ts` → `registerTurkishFont`).

## İkonlar

- Kütüphane: `lucide-react`.
- Kenar çubuğu ikonları 3 seçilebilir "ikon seti" üzerinden gelir:
  `src/features/appSettings/iconSets.ts` (`klasik` / `modern` / `3d`), her biri
  farklı ikon seçimleri + görsel varyant (`outline` | `bold` | `3d`) taşır.
  Ayarlar sayfasından seçilir, `AppShell.tsx` → `iconBoxClasses()` varyanta göre
  kutu stilini uygular.
- Sayfa içi ikonlar (kart başlıkları, butonlar, tablo hücreleri) doğrudan
  `lucide-react`'tan import edilip kullanılır; yeni bir ikon kütüphanesi eklenmez.

## Temel UI bileşenleri (`src/components/ui/`)

shadcn/ui tabanlı, Radix primitiflerinin üzerine kurulu. Hepsi `class-variance-authority`
ile varyantlanır, `cn()` (`src/lib/utils.ts`) ile className birleştirilir.

| Bileşen | Dosya | Varyantlar / notlar |
|---|---|---|
| Button | `button.tsx` | `default` (gradient, birincil aksiyon), `destructive`, `outline`, `secondary`, `ghost`, `link`; boyut: `sm`/`default`/`lg`/`icon` |
| Card | `card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` — hafif gradient arka plan + iç gölge (`shadow-[...inset...]`) |
| Badge | `badge.tsx` | `default`, `secondary`, `destructive`, `success`, `warning`, `outline` |
| Table | `table.tsx` | Standart shadcn tablo hücreleri |
| Dialog | `dialog.tsx` | Modal formlar için (`Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`) |
| Form alanları | `input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `label.tsx`, `form.tsx` | `react-hook-form` + `zod` ile birlikte kullanılır |
| Para girişi | `currency-input.tsx` | Türkçe binlik ayraç + ondalık virgül formatlı özel input; tüm para alanlarında (`unit_price`, `amount`, `total_debt` vb.) kullanılır |
| Diğer | `avatar.tsx`, `popover.tsx`, `dropdown-menu.tsx`, `command.tsx`, `separator.tsx`, `tabs.tsx`, `sonner.tsx` (toast) | |

Yeni bir sayfa bir "kart + tablo" veya "kart + form dialog" ihtiyacı duyuyorsa
bu bileşenler doğrudan import edilip kullanılır; yeni bir Button/Card/Table
bileşeni yazılmaz.

## Grafik/görselleştirme

- `recharts` tabanlı grafikler: `src/components/charts/`.
- Türkiye satış haritası: `src/components/charts/TurkeyMap.tsx` +
  `src/lib/turkeyMapPaths.ts` (gerçek il sınırları, hover'da ilin adı + yanıp
  sönme animasyonu).

## Dışa aktarım (Excel / Word / PDF)

`src/lib/exportData.ts` + `src/components/ExportMenu.tsx` — her liste sayfasında
aynı dışa aktarma menüsü kullanılır (yeni bir export mekanizması icat edilmez).

## Metin / dil

Tüm arayüz metinleri `src/i18n/tr.ts` üzerinden gelir — sabit Türkçe metin
doğrudan JSX içine yazılmaz, gerektiğinde bu dosyaya eklenir.

## Yeni bir sayfa eklerken kontrol listesi

1. `AppShell` içindeki `Outlet`'e `App.tsx`'te yeni bir `<Route>` ekle (mevcut
   route'ların sırası/yolları değişmez).
2. Sayfa gövdesini `PageHeader` ile başlat.
3. İçerik `Card` bileşenleri içinde gruplanır.
4. Liste görünümleri `Table` + `ExportMenu`, formlar `react-hook-form` + `zod` +
   `Dialog` (veya sayfa içi form) + varsa `CurrencyInput`.
5. Renk/ikon için yeni bir şey tanımlamadan yukarıdaki tema/ikon sistemini kullan.
6. Admin-only bir sayfaysa `AdminRoute` sarmalayıcısını kullan (`ayarlar` örneği).
