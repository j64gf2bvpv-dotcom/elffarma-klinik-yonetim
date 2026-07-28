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
alarak bu uyarıları tamamen kaldırabilir ve otomatik güncelleme (auto-update)
özelliğini etkinleştirebilirsiniz — bu depoda hazır değildir.

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
