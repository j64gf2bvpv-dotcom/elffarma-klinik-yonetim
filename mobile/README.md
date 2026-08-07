# Elffarma Mobil (Faz 1)

Masaüstü Electron uygulamasıyla **aynı Supabase projesini** kullanan native
React Native (Expo) mobil uygulaması. Plan: `/Users/erkankongul/.claude/plans/greedy-gathering-galaxy.md`.

## Kurulum

```bash
cd mobile
npm install
```

`.env` zaten masaüstüyle aynı Supabase URL/anon key ile dolu (bkz. `.env.example`
şablonu — farklı bir Supabase projesine ASLA işaret etmemeli).

## Çalıştırma

`expo-sqlite`, `@react-native-community/netinfo`, `@gorhom/bottom-sheet` gibi
native modüller **plain Expo Go'da çalışmaz** — bir dev client build'i gerekir:

```bash
npx expo run:ios      # veya
npx expo run:android
```

Sonraki çalıştırmalarda (native kod değişmediyse):

```bash
npx expo start
```

## Faz 1 kapsamı

Giriş/çıkış, oturum kalıcılığı, şifre sıfırlama (deep link), Anasayfa
(gerçek stat kartları), Cari Hesap (liste+detay), Stok (liste + stok hareketi
kaydetme — `record_stock_movement` RPC'si üzerinden), Tahsilatlar (liste +
tahsilat kaydetme). "Diğer" sekmesindeki tüm diğer bölümler "yakında" olarak
görünür — bkz. plan §Phase 2-6.

## Faz 1 doğrulama listesi

1. Gerçek bir personel hesabıyla giriş yapın; yanlış şifre masaüstüyle aynı
   Türkçe hata mesajını göstermeli; uygulamayı kapatıp açınca oturum devam
   etmeli.
2. Anasayfa'daki rakamlar masaüstündeki aynı hesapla eşleşmeli.
3. Cari Hesap listesi/detayı gerçek müşteri/bakiye verisini göstermeli.
4. Stok'ta bir ürüne "Giriş" hareketi kaydedin (online) — miktar güncellenmeli,
   `stock_movements`'ta yeni satır görünmeli (masaüstünden kontrol edin).
   Sonra uçak modunu açıp başka bir hareket kaydedin — "bekleyen kayıt"
   rozeti görünmeli; bağlantıyı geri açınca otomatik gönderilip miktar RPC'nin
   hesapladığı doğru değere yakınsamalı.
5. Tahsilatlar'da aynı online/offline testini bir tahsilat kaydıyla tekrarlayın.
6. Yönetici olmayan bir test hesabında "Diğer > Ayarlar" görünmemeli; yönetici
   hesabında görünmeli.
