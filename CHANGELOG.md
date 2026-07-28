# Değişiklik Günlüğü

Bu dosya, Elffarma Paket Programı'nda sürüm bazında yapılan değişiklikleri listeler.
Sürümleme [Semantic Versioning](https://semver.org/lang/tr/) mantığına göre yapılır (v1.0.0, v1.1.0, v2.0.0 ...).

## [1.5.5] - 2026-07-29

En Çok Satan Ürünler widget'ı, ince "çizgi" görünümlü ilerleme çubukları yerine gerçek bir Recharts yatay çubuk grafiğine (`TopProductsChart`) dönüştürüldü — altın/gümüş/bronz gradyanlı çubuklar, animasyonlu giriş, özel tooltip (adet + ciro). Satışlar → Raporlar sekmesindeki mevcut grafik kalitesiyle tutarlı.

## [1.5.4] - 2026-07-29

Doktor Performansı widget'ı kaldırıldı. En Çok Satan Ürünler widget'ı animasyonlu, premium bir tasarıma kavuştu: altın/gümüş/bronz sıra rozetleri, sayaç animasyonlu adet/ciro rakamları, kademeli (staggered) giriş animasyonu ve sıfırdan dolan ilerleme çubukları.

## [1.5.3] - 2026-07-29

Geliştirme planı Aşama 1: Dashboard profesyonelleştirildi. Eklenenler — Gün/Hafta/Ay/Yıl kırılımlı Tahsilat ve Satış trend grafikleri, En Çok Satan Ürünler, Doktor Performansı, Kritik Uyarılar ve Yaklaşan Hatırlatmalar widget'ları; "Son Tahsilatlar" widget'ı gerçek bir "Son İşlemler" akışına (tahsilat+satış birleşik) dönüştürüldü. Mevcut widget sürükle-bırak/göster-gizle sistemi korunarak yeni widget'lar bu sisteme eklendi.

## [1.5.2] - 2026-07-29

`.claude/settings.json`'a, sık kullanılan salt-okunur komutlar (`npx tsc`, `npm run lint`, `git fetch` vb.) için izin listesi eklendi — geliştirme sırasında daha az onay istemi çıkar.

## [1.5.1] - 2026-07-29

Her tamamlanan değişiklik artık otomatik olarak versiyon artırılıp commit/push ediliyor (bkz. `CLAUDE.md` "Git workflow" bölümü) — bu kuralın kendisi ilk kez bu sürümde uygulandı.

## [1.0.0] - 2026-07-26

İlk resmi üretim sürümü. Bu sürümden sonra proje artık canlı kullanımda olan ana Elffarma ERP kaynak kodu olarak kabul edilir; bundan sonraki tüm geliştirmeler bu temel üzerine katma değer olarak eklenir (mevcut yapı bozulmaz).

### Kapsam
- **Doktorlar**: Şahıs/Hastane ayrımı, il ve hastane bilgisi, fatura bilgileri (TC/vergi no, KDV, adres), ödeme vadesi takibi ve uyarı rozetleri, eksik ürün/eksik bakiye takibi.
- **Stok**: Ürün kategorileri (Dermakor/Swiss), barkod, SKT takibi, kritik stok uyarıları, stok hareket defteri.
- **Tahsilatlar**: Ödeme kaydı, satış temsilcisi ataması, fatura eki entegrasyonu.
- **Kongreler**: Katılımcı ve ürün yönetimi, paket fiyatları (tekli/ikili katılım), kongre satışlarının stoktan otomatik düşümü.
- **Satış Temsilcisi Paneli**: Haftalık/aylık ciro, doktor ve ürün bazlı performans raporları.
- **Panel (Dashboard)**: Türkiye satış haritası, güncel döviz kurları, kritik stok/ödeme/SKT bildirimleri (kırmızı yanıp sönen rozetler), kongre paket fiyatları özeti.
- **Ayarlar**: Kurumsal bilgiler, fatura & banka bilgileri (IBAN paylaşımı için WhatsApp şablonu), tema (9 renk + beyaz/nötr) ve ikon seti (3 farklı görsel varyant) seçimi.
- **Rapor & Dışa Aktarım**: Tüm panellerde Excel/Word/PDF (Türkçe karakter destekli) dışa aktarım.
- **Kimlik Doğrulama**: E-posta/şifre girişi, deep-link tabanlı "Şifremi Unuttum" akışı.
- **Masaüstü Paketleme**: macOS (.dmg, arm64) ve Windows (.exe, NSIS) kurulum dosyaları.

### Not
Bu sürümden önceki geliştirme geçmişi git commit geçmişinde mevcuttur; bu CHANGELOG bundan sonraki sürümleri takip eder.
