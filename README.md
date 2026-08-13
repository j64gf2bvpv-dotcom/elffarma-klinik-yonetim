# Klinik Yönetim

Medikal estetik klinikleri için masaüstü yönetim programı: müşteri kayıtları, stok
takibi, tahsilatlar, takvim/randevu-hatırlatma ve WhatsApp üzerinden tek tıkla
bilgilendirme.

## Kurulum (ilk defa)

### 1. Supabase projesi oluşturun

1. [supabase.com](https://supabase.com) adresinden ücretsiz bir hesap açın, **New Project**
   ile yeni bir proje oluşturun (bölge olarak Frankfurt/EU önerilir).
2. Güçlü bir veritabanı şifresi belirleyip güvenli bir yerde saklayın.
3. Proje oluştuktan sonra **Project Settings → API** sayfasından **Project URL** ve
   **anon public key** değerlerini kopyalayın.
4. **SQL Editor**'ü açın, bu depodaki [`supabase/schema.sql`](supabase/schema.sql)
   dosyasının tamamını yapıştırıp çalıştırın. Bu tek işlem tüm tabloları, güvenlik
   kurallarını (RLS) ve örnek WhatsApp şablonlarını oluşturur.
5. **Authentication → Users** sayfasından kendi e-posta/şifrenizle ilk kullanıcıyı
   oluşturun. İlk oluşturulan kullanıcı otomatik olarak **admin** rolüyle
   `staff` tablosuna eklenir. Sonraki personel hesaplarını da aynı ekrandan
   oluşturabilirsiniz; rollerini uygulama içindeki **Ayarlar** sayfasından
   yönetirsiniz.

### 2. Ortam değişkenlerini ayarlayın

`.env.example` dosyasını `.env` olarak kopyalayıp değerleri doldurun:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=...          # Project Settings > API > Project URL
VITE_SUPABASE_ANON_KEY=...     # Project Settings > API > anon public key
VITE_CLINIC_NAME=Klinik Adınız # Uygulama başlığı ve WhatsApp mesajlarında kullanılır
```

### 3. Bağımlılıkları kurun

```bash
npm install
```

## Geliştirme

```bash
npm run dev
```

Bu komut Vite'ı ve Electron penceresini birlikte başlatır (`vite-plugin-electron`
sayesinde). `.env` dosyasında geçerli Supabase bilgileri yoksa uygulama yine açılır,
giriş ekranında bir uyarı gösterir ve veri işlemleri başarısız olur.

## Paketleme (kurulabilir uygulama üretme)

```bash
npm run package
```

Bu komut önce `vite build` ile renderer + Electron main/preload dosyalarını
derler, ardından `electron-builder` ile `release/` klasörüne kurulabilir bir
`.dmg` (Mac) veya NSIS `.exe` (Windows) üretir — çalıştırıldığı platforma göre.

**macOS imzalama (2026-08-13'ten itibaren):** Uygulama artık gerçek bir Apple
Developer ID Application sertifikasıyla imzalanıp notarize ediliyor (bkz.
`electron-builder.yml`: `mac.hardenedRuntime`/`entitlements`/`notarize`, ve
`.github/workflows/release.yml`'deki `CSC_LINK`/`APPLE_ID`/... secret'ları).
İlk açılışta hâlâ macOS'un standart "İnternetten indirildi, açmak istediğinize
emin misiniz?" onayı çıkar (bu normal, kötü amaçlı yazılım kontrolü) ama artık
"geliştirici doğrulanamadı"/"hasar görmüş" gibi bloklayıcı bir uyarı yok.

**Windows** tarafı hâlâ imzasız — SmartScreen benzer bir uyarı gösterir;
**Diğer Bilgiler → Yine de Çalıştır** ile devam edilebilir. İsterseniz bir
Windows kod imzalama sertifikası (~$100-400/yıl) alarak bunu da kaldırabilirsiniz.

## Kurulum sonrası: kısayollar ve tek tıkla açılış

- **Windows**: NSIS kurulum sihirbazı (İleri → Kurulum Yeri Seç → Kur → Bitir)
  masaüstüne ve Başlat Menüsü'ne "Elffarma Paket Programı" kısayolu ekler;
  kurulumdan sonra bu kısayola çift tıklamak yeterlidir.
- **macOS**: `.dmg` açıldığında görünen pencerede uygulama ikonunu
  **Uygulamalar** klasörü kısayoluna sürükleyin; sonrasında Launchpad/Uygulamalar'dan
  tek tıkla açılır.
- Kurulan uygulama, geliştirme ortamını (Node.js, VS Code, proje kaynak kodu)
  hiçbir şekilde gerektirmez — Electron, kendi Chromium/Node çalışma zamanını
  paketin içine gömer. Kullanıcıya sadece `Setup.exe` ya da `.dmg` dosyasını
  göndermeniz yeterlidir; proje dosyalarına erişimleri olmaz.

## Yayınlama (Release) ve otomatik güncelleme

Sürüm numarası `package.json` → `version` alanından gelir (şu an `2.17.60`).
Yeni bir sürüm yayınlamak için:

1. `package.json`'daki `version`'ı artırın (`1.5.1`, `1.6.0` vb.) ve
   `CHANGELOG.md`'ye bir madde ekleyin.
2. `git tag v1.6.0 && git push origin v1.6.0` (versiyonu gerçek numarayla
   değiştirin).
3. Bu tag push'u `.github/workflows/release.yml` iş akışını tetikler; bu iş
   akışı **gerçek bir Windows runner'ında** Setup.exe (NSIS) ve **gerçek bir
   macOS runner'ında** .dmg üretip **doğrudan yayınlanmış** bir GitHub
   Release'e yükler (geliştirme makinesi macOS olduğu ve `wine` kurulu
   olmadığı için Windows kurulum paketi yerelde üretilemez — CI asıl dağıtım
   yoludur). Elle "Publish release" adımı YOK — tag push'ladığınız an, birkaç
   dakika içinde (CI derlemesi bitince) kurulu tüm uygulamalar
   (`electron-updater` üzerinden, internet bağlantısı olan her PC'de)
   arka planda yeni sürümü indirip kullanıcıya "yeniden başlat" bildirimi
   gösterir. Bu nedenle **sadece gerçekten dağıtmak istediğiniz, test edilmiş
   bir sürüm için tag push'layın** — rutin küçük düzeltme commit'leri (tag'siz)
   hiçbir kurulu uygulamayı etkilemez, sadece `package.json` sürüm numarasını
   ilerletir.

**Önemli — Supabase yapılandırması**: Vite, `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` değerlerini **build anında** derlenmiş dosyanın içine
gömer (çalışma zamanında `.env` okunmaz). Bu, kaynak kodun dağıtılması anlamına
gelmez — her normal Electron uygulamasında olduğu gibi sadece derlenmiş,
minifiye edilmiş bundle dağıtılır. Ama bu değerler gerçek olmadan paketlenirse
(placeholder ile), dağıtılan uygulama hiçbir veriye erişemez. Bunu önlemek için
`npm run package`/`npm run dist` çalıştırılmadan hemen önce
`scripts/check-release-env.mjs` otomatik çalışır ve gerçek değerler yoksa
paketlemeyi durdurur. CI'da bu değerler repository secrets olarak
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) tanımlanmalıdır — bkz.
`.github/workflows/release.yml` üstündeki yorum.

**macOS'ta auto-update artık güvenilir çalışıyor** (2026-08-13'ten itibaren):
gerçek Developer ID imzası + notarization sayesinde Squirrel.Mac indirilen
güncellemeyi doğrulayabiliyor. Daha önce burada belgelenen "imzasız paket
güncellemeyi doğrulayamıyor" sınırlaması artık geçerli değil.

## Mimari özeti

- **Electron + React + TypeScript + Vite** masaüstü kabuğu, ayrı bir sunucu
  yok — renderer doğrudan Supabase'e (Postgres + Auth + Row Level Security)
  bağlanır.
- Güvenlik: renderer'da `nodeIntegration: false`, `contextIsolation: true`;
  `electron/preload.ts` sadece WhatsApp linki açma ve bildirim gösterme için
  dar bir API yüzeyi sağlar.
- Veri modeli ve yetkilendirme kuralları tamamen `supabase/schema.sql`
  içinde tanımlıdır (tek kaynak — şema değiştiğinde bu dosya güncellenmeli
  ve Supabase SQL Editor'de tekrar çalıştırılmalıdır).
- Daha fazla mimari detay için [`CLAUDE.md`](CLAUDE.md) dosyasına bakın.

## Bilinen sınırlamalar (MVP kapsamı)

- **Çevrimdışı yazma kuyruğu yok**: internet yokken yapılan ekleme/düzenleme
  işlemleri sessizce kaybolmaz, açık bir hata gösterir. Okuma verileri kısa
  süreliğine önbelleklenir. Kenar çubuğundaki yeşil/kırmızı nokta bağlantı
  durumunu gösterir.
- **WhatsApp gönderimi elle onaylanır**: `wa.me` linkleri mesajı hazırşekilde
  açar, gönder tuşuna basmak personele aittir; program bir mesajın gerçekten
  gönderildiğini otomatik olarak algılayamaz (bu yüzden "gönderildi" işareti
  elle onaylanan bir onay kutusudur).
- **Yeni personel eklemek** şu an Supabase Dashboard üzerinden yapılıyor
  (uygulama içinden değil) — bkz. Kurulum adım 1.5.
