# Değişiklik Günlüğü

Bu dosya, Elffarma Paket Programı'nda sürüm bazında yapılan değişiklikleri listeler.
Sürümleme [Semantic Versioning](https://semver.org/lang/tr/) mantığına göre yapılır (v1.0.0, v1.1.0, v2.0.0 ...).

## [2.1.1] - 2026-07-29

İçe aktarma düğmesi artık bir açılır menü: "Örnek Şablonu İndir (.xlsx)" seçeneği, doğru sütun başlıkları ve örnek bir satırla dolu bir Excel dosyası indirir (Cari Kart, Stok, Tahsilatlar için ayrı ayrı) — kullanıcı bu şablonu doldurup aynı menüden "Excel Dosyası Seç..." ile geri yükleyebilir.

## [2.1.0] - 2026-07-29

**Excel'den içe aktarma** eklendi — Cari Kart (doktorlar), Stok (ürünler) ve Tahsilatlar sayfalarına, mevcut "Dışa Aktar" düğmesinin yanına bir "İçe Aktar (Excel)" düğmesi eklendi:
- Dışa aktarılan bir Excel dosyası aynı sütun başlıklarıyla geri yüklenebilir (round-trip).
- Var olan bir kayda denk gelen satırlar (telefon/ürün adı-SKU/doktor+tarih+tutar+yöntem eşleşmesi) atlanır, çakışmayanlar eklenir; işlem sonunda "X eklendi, Y atlandı" özeti gösterilir.
- Stok içe aktarımında "Başlangıç Stoğu" verilirse gerçek bir stok hareketi (giriş) olarak işlenir — `current_quantity` asla doğrudan yazılmaz.
- Word/PDF'ten içe aktarma bilerek eklenmedi — bu formatlar yapılandırılmış tabloyu güvenilir şekilde geri okumaya uygun değil, sadece dışa aktarımda kalmaya devam ediyor.

## [2.0.1] - 2026-07-29

Cari Kart'ta yeni doktor eklerken artık aynı anda aldığı ürünleri de ekleyebilirsiniz — "Yeni Doktor" formuna opsiyonel bir "Aldığı Ürünler" bölümü eklendi (birden fazla ürün, adet ve birim fiyat girilebilir). Doktor kaydedildiğinde her ürün satırı gerçek bir satış kaydı olarak işlenir ve stoktan otomatik düşülür (mevcut Satışlar akışıyla aynı mantık).

## [2.0.0] - 2026-07-29

Geliştirme planının AŞAMA 1-6'sı tamamlandı — kapsamlı ERP geliştirme turu bu sürümle sonuçlanıyor (AŞAMA 7 / AI özellikleri, ayrı bir mimari kararı gerektirdiği için kullanıcı isteğiyle bilinçli olarak bu sürüme dahil edilmedi, ileride ayrıca ele alınacak).

**Bu turda eklenenlerin özeti** (ayrıntılar için 1.5.3–1.10.0 arası maddelere bakın):
- Dashboard: periyot kırılımlı grafikler, en çok satan ürünler, kritik uyarılar, yaklaşan hatırlatmalar, gerçek "son işlemler" akışı.
- Doktor/Cari: yaşlandırma raporu, birleşik işlem geçmişi, etiket filtresi.
- Stok: stok değerleme, sipariş önerileri, kâr marjı.
- Satış/Tahsilat/Kasa: kasa özeti (nakit/kart/havale günlük döküm), satış tarih filtresi.
- Kongre: gerçek karlılık analizi (gelir−maliyet), kalan ürün takibi.
- Raporlar/Finans: Gelir-Gider raporu, eksik dışa aktarımlar tamamlandı.

**Paketleme doğrulandı**: `npm run package` ile macOS .dmg (arm64) yerel olarak başarıyla üretildi ve test edildi; Windows .exe (NSIS) GitHub Actions üzerinden (`v*.*.*` tag push'unda) derlenip taslak GitHub Release'e yükleniyor. Otomatik güncelleme altyapısı (electron-updater) önceki sürümde kurulmuştu, bu sürümde değişmedi.

## [1.10.0] - 2026-07-29

Geliştirme planı Aşama 6: Raporlar ve Finans ekranları geliştirildi.
- **Gelir-Gider Raporu** (yeni): Satışlar → Raporlar sekmesine, tahsilat (gelir) ve gider kayıtlarını son 6 ay için aylık karşılaştıran, net kâr/zarar gösteren, dışa aktarılabilir yeni bir rapor eklendi — daha önce gelir ve gider hiçbir yerde birlikte gösterilmiyordu.
- Giderler ve Bütçe Yılı sayfalarına eksik olan dışa aktarım (Excel/Word/PDF) eklendi.

(Not: AŞAMA 7 — yapay zeka özellikleri — kullanıcı isteğiyle şimdilik atlandı, ayrı bir görüşmeyle ele alınacak.)

## [1.9.0] - 2026-07-29

Geliştirme planı Aşama 5: Kongre ve Workshop yönetimi geliştirildi.
- **Karlılık Analizi**: Kongre detayında artık gerçek bir Gelir (ürün satışı) − Maliyet (uçak+kayıt+konaklama) = Net Kâr/Zarar hesabı ve kâr marjı % gösteriliyor (önceden hepsi tek bir "paket fiyatı" toplamında karışıktı).
- **Kalan/Kullanılmayan Ürünler**: Şemada olup hiç bağlanmamış `congress_remaining_products` özelliği hayata geçirildi — ekle/sil ve toplam değer.
- Kongre listesine dışa aktarım (Excel/Word/PDF) eklendi — daha önce hiç yoktu.

## [1.8.0] - 2026-07-29

Geliştirme planı Aşama 4: Satış, Tahsilat ve Kasa modülleri geliştirildi.
- **Kasa Özeti** (yeni): Tahsilatlar sayfasına, daha önce hiç var olmayan bir "kasa" görünümü eklendi — nakit/kredi kartı/havale yöntem bazlı toplam kartları ve seçili tarih aralığı için günlük döküm tablosu.
- **Satışlar tab'ına tarih filtresi** eklendi (Tahsilatlar sayfasında zaten vardı, Satışlar'da eksikti) — filtre hem tabloyu hem dışa aktarımı etkiliyor.

## [1.7.0] - 2026-07-29

Geliştirme planı Aşama 3: Stok ve Ürün Yönetimi profesyonel ERP seviyesine çıkarıldı.
- **Stok Değerleme**: Toplam stok değeri (maliyet ve satış fiyatına göre) ve potansiyel kâr özet kartları.
- **Sipariş Önerileri**: Kritik stoktaki ürünler için otomatik önerilen sipariş miktarı ve tahmini maliyet.
- **Kâr marjı** rozetleri ürün listesinde satış fiyatının yanında.
- **Ürün görseli URL** alanı forma eklendi (şemada vardı, arayüzde eksikti).

## [1.6.0] - 2026-07-29

Geliştirme planı Aşama 2: Doktor ve Cari Yönetimi profesyonel ERP seviyesine çıkarıldı.
- **Yaşlandırma Raporu** (Cari Hesap Listesi): 1-30/31-60/61-90/90+ gün gecikme kovalarına göre bakiye dağılımı ve her doktor satırında "Vade Durumu" rozeti.
- **İşlem Geçmişi**: Doktor detay sayfasına tahsilat+satış/iade+fatura kayıtlarını tek kronolojik akışta birleştiren yeni bir kart eklendi.
- **E-posta alanı**: `customers.email` şemada var olup arayüzde eksikti (ölü kolon) — Customer tipine, forma ve detay sayfasına eklendi.
- **Etiket filtresi**: Cari Kart listesinde artık doktorlar etikete göre de filtrelenebiliyor.

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
