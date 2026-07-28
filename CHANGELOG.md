# Değişiklik Günlüğü

Bu dosya, Elffarma Paket Programı'nda sürüm bazında yapılan değişiklikleri listeler.
Sürümleme [Semantic Versioning](https://semver.org/lang/tr/) mantığına göre yapılır (v1.0.0, v1.1.0, v2.0.0 ...).

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
