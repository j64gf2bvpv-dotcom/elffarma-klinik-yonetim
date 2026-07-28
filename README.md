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

**Önemli:** Uygulama şu an **imzasız (unsigned)** olarak paketleniyor:

- macOS'ta ilk açılışta Gatekeeper "geliştirici doğrulanamadı" uyarısı verir;
  kullanıcı dosyaya sağ tıklayıp **Aç**'ı seçerek bir kereliğine bunu aşabilir.
- Windows'ta SmartScreen benzer bir uyarı gösterir; **Diğer Bilgiler → Yine de
  Çalıştır** ile devam edilebilir.

Bu, günlük kullanım için engel değildir. İleride isterseniz bir Apple Developer
hesabı (yıllık ~$99) ve/veya Windows kod imzalama sertifikası (~$100-400/yıl)
alarak bu uyarıları tamamen kaldırabilirsiniz.

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

Sürüm numarası `package.json` → `version` alanından gelir (şu an `1.5.0`).
Yeni bir sürüm yayınlamak için:

1. `package.json`'daki `version`'ı artırın (`1.5.1`, `1.6.0` vb.) ve
   `CHANGELOG.md`'ye bir madde ekleyin.
2. `git tag v1.6.0 && git push origin v1.6.0` (versiyonu gerçek numarayla
   değiştirin).
3. Bu tag push'u `.github/workflows/release.yml` iş akışını tetikler; bu iş
   akışı **gerçek bir Windows runner'ında** Setup.exe (NSIS) ve **gerçek bir
   macOS runner'ında** .dmg üretip bir GitHub Release'e **taslak (draft)**
   olarak yükler (geliştirme makinesi macOS olduğu ve `wine` kurulu olmadığı
   için Windows kurulum paketi yerelde üretilemez — CI asıl dağıtım yoludur).
4. GitHub → Releases sayfasından taslağı inceleyip **Publish release**
   yapın. Yayınlandığı andan itibaren kurulu uygulamalar
   (`electron-updater` üzerinden) yeni sürümü fark edip arka planda indirir
   ve kullanıcıya "yeniden başlat" bildirimi gösterir.

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

**macOS'ta auto-update ile ilgili bilinen sınırlama**: `mac.identity: null`
(imzasız paketleme) hâlâ geçerli olduğu için macOS'ta otomatik güncelleme
motoru (Squirrel.Mac) indirilen güncellemeyi doğrulayamayabilir — bu, yukarıda
bahsedilen Apple Developer imzası/notarization eklenene kadar sürecek bilinen
bir sınırlamadır. Windows tarafında (NSIS + electron-updater) bu kısıtlama
yoktur.

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
