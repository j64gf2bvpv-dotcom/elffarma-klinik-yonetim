# Değişiklik Günlüğü

Bu dosya, Elffarma Paket Programı'nda sürüm bazında yapılan değişiklikleri listeler.
Sürümleme [Semantic Versioning](https://semver.org/lang/tr/) mantığına göre yapılır (v1.0.0, v1.1.0, v2.0.0 ...).

## [2.15.2] - 2026-08-04

**Akıllı İçe Aktar (AI) taranmış/görsel PDF'leri de okuyabiliyor, Tahsilatlar'a da eklendi:** Kök neden — PDF'in metin katmanı boşsa (yani belge taranmış bir görüntüyse) önceden hiçbir şey çıkarılamıyordu. Artık metin katmanı neredeyse boşsa (taranmış belge belirtisi) otomatik olarak sayfalar görsele çevrilip yapay zekaya vision yoluyla okutuluyor (en fazla 3 sayfa). AI'a giden talimat da güçlendirildi: belgedeki HER kaydı atlamadan çıkarması, farklı yazılmış tarih/tutar gibi değerleri hedef formata normalize etmesi isteniyor. "Akıllı İçe Aktar" butonu daha önce sadece Stok ve Cari Kart'ta vardı — artık Tahsilatlar sayfasına da eklendi (aynı Doktor/Tutar/Tarih/Yöntem/Temsilci/Açıklama şablonuyla). Excel/CSV, Word (.docx) ve düz resim desteği zaten mevcuttu, değişmedi. Şema değişikliği yok.

## [2.15.1] - 2026-08-04

**Örnek veri doktorlara fotoğraf ve VIP durumu ekliyor, doktor fotoğrafı artık arayüzde görünüyor:** `Customer.photo_url` alanı şemada vardı ama hiçbir sayfada gösterilmiyordu — Cari Kart başlığına ve Cari Kart listesindeki satırlara küçük bir avatar (fotoğraf yoksa baş harfler) eklendi. Örnek veri artık her doktora ürün/temsilci/kongrede olduğu gibi bir avatar görseli ve VIP/Normal durumu atıyor. Şema değişikliği yok.

## [2.15.0] - 2026-08-04

**Klinikler paneli kaldırıldı, doktor VIP/Normal durumu doğrudan Cari Kart'ta işaretlenebiliyor:** Sol menüdeki "Klinikler" sayfası (liste + detay) kaldırıldı. `customers` tablosuna yeni bir `is_vip` alanı eklendi ve doktor formuna "VIP doktor" onay kutusu geldi — Cari Kart başlığında ve doktor listesinde artık VIP doktorlar rozet/yıldızla ayırt ediliyor. Klinik alt yapısı (klinik seçimi, prim kurallarındaki "klinik bazlı" kapsam) bilerek korundu — hiçbir prim hesabı bozulmadı; doktor formundaki "Klinik" alanına artık satır içinden "+ Yeni Klinik Ekle" ile de klinik oluşturulabiliyor (önceden bu sadece ayrı Klinikler sayfasından yapılabiliyordu, sayfa kalkınca bu yol tek girişti). **Şema değişti** — `supabase/schema.sql`'i Supabase SQL editöründe tekrar çalıştırmanız gerekiyor (`customers.is_vip` sütunu eklendi, idempotent).

## [2.14.12] - 2026-08-04

**Ajanda'da düz tek renk rozetler yerine hafif hareketli gradyan, yazılar daha belirgin:** İstatistik kartları ve "Takvimler" satırlarındaki ikon rozetleri artık %15 opaklıklı düz renk yerine kendi renginin açık→koyu diyagonal gradyanını (beyaz ikon üstünde, daha yüksek kontrast) alıyor ve gradyan yavaşça kayarak "canlı" duruyor. İstatistik sayıları büyütüldü (2xl, bold), takvim türü etiketleri ve sayı rozetleri daha kalın. Takvimdeki gün başlıkları/gün numaraları ve etkinlik başlıkları da daha koyu/kalın — artık soluk gri değil, tam kontrastlı. Şema değişikliği yok.

## [2.14.11] - 2026-08-04

**Ajanda'ya profesyonel bir hareket/animasyon katmanı ve yeni bir özet şeridi eklendi:** Sayfanın üstüne "Bu Ay / Bugün / Gecikmiş" etkinlik sayılarını sayarak gösteren (count-up animasyonlu) 3 küçük istatistik kartı eklendi. Sayfa açıldığında mini takvim, Takvimler filtre kartı, istatistik kartları ve ana takvim art arda (staggered) yumuşak bir şekilde yükselerek beliriyor. Mini takvimde seçili/bugün günü artık hafif büyüyerek (scale) öne çıkıyor, ay değiştirildiğinde tüm gün ızgarası yeniden belirme animasyonuyla geçiş yapıyor, bugünün tarihi nazikçe nabız gibi atıyor. Takvim etkinlik kutucukları artık listeye eklenirken kayarak beliriyor. Tüm animasyonlar `prefers-reduced-motion` tercihine saygılı. Şema değişikliği yok. (`useCountUp` hook'u Ana Panel'in eski widget'lı görünümüyle paylaşılan ortak bir dosyaya taşındı.)

## [2.14.10] - 2026-08-04

**Kongreler listesinde görselsiz kongreler artık tek düze gri değil, doktor/ürün kartlarındaki gibi isme göre renkli:** `Kongreler` sayfasındaki kart görünümünde, görseli yüklenmemiş her kongre aynı düz gri kutuda aynı ikonu gösteriyordu; artık Ana Panel'deki "Yaklaşan Kongreler" kartıyla aynı mantıkla (`placeholderColor`) kongre adına göre sabit ama kongreden kongreye değişen bir renk alıyor — liste artık tek renkli görünmüyor. Şema değişikliği yok.

## [2.14.9] - 2026-08-04

**Cari Kart'tan aylık/yıllık numune kotası kaldırıldı:** Doktor formundaki "Aylık Numune Kotası" ve "Yıllık Numune Kotası" alanları ve numune eklerken tetiklenen "kota aşılıyor" uyarısı kaldırıldı — artık sadece bir önceki sürümde eklenen basit "verildi" işaret kutusu var, kota takibi yok. Şema değişikliği yok (ilgili sütunlar veritabanında duruyor, kullanılmıyor).

## [2.14.8] - 2026-08-04

**Numune Takibi ayrı bir modül olmaktan çıkarıldı, Cari Kart'ta basit bir işaretleme haline geldi:** Sol menüdeki "Numune Takibi" sayfası ve onay/kargo/teslim iş akışı (durum dropdown'ı, kargo takip no, teslim alan alanları, ayrı istatistik kartları) kaldırıldı. Doktorun Cari Kart sayfasındaki "Numuneler" sekmesi artık her numune kaydını ürün/adet/tarih özetiyle ve tek bir "verildi" işaret kutusuyla gösteriyor — kutuyu işaretlemek durumu doğrudan günceller, ayrı bir sayfaya gitmeye gerek yok. Numune ekleme formu (ürün/lot/SKT/adet, aylık kota uyarısı) ve stok hareketi entegrasyonu aynen korundu, sadece görüntüleme/yönetim tarafı sadeleşti. Eski özelleştirilebilir Panel'deki kullanılmayan "Numune Dönüşüm Oranı" widget'ı da kaldırıldı. Şema değişikliği yok (veritabanı tabloları ve geçmiş veriler korunuyor).

## [2.14.7] - 2026-08-04

**Ajanda görselleri belirginleştirildi:** Kök neden bulundu — FullCalendar'ın varsayılan mavi etkinlik zemini (`--fc-event-bg-color`) hiç ezilmemişti, bu yüzden Kongre/Ödeme Vadesi/Hatırlatma etkinlikleri türden bağımsız hep aynı mavi kutuda görünüyordu; artık her etkinlik kendi rengiyle soluk bir zemin + sol renk şeridi alıyor. "Takvimler" filtre listesi diğer panel kartlarıyla tutarlı bir ikonlu başlığa ve renkli ikon rozeti + sayı rozetine kavuştu. Mini takvimdeki gün butonları büyütüldü (28px→36px) ve nokta olmayan günlerde de aynı yükseklikte kalacak şekilde hizalandı. Takvim günü kutucuklarına üzerine gelince hafif vurgu ve daha ferah bir minimum yükseklik eklendi. Şema değişikliği yok.

## [2.14.6] - 2026-08-04

**Ana Panel'de Tahsilat Hedefi kartı yerine Ajanda mini takvimi:** Orta sıradaki "Tahsilat Hedefi" göstergesi kaldırıldı, yerine o ayın etkinlik noktalarını gösteren ve "Tümünü gör" ile Ajanda'ya götüren yeni bir mini takvim kartı (`AgendaMiniCard`) eklendi. Ajanda'nın mini takvim ve etkinlik-birleştirme mantığı (`MiniCalendar`, `useAgendaEvents`) hem Ajanda sayfasında hem bu yeni kartta ortak kullanılan paylaşılan bileşenlere taşındı — kod tekrarı yok. Artık hiçbir yerde kullanılmayan `CollectionTargetGauge`/`RadialGauge` bileşenleri ve `useDashboardData`'daki ilgili hedef hesaplama mantığı kaldırıldı. Şema değişikliği yok.

## [2.14.5] - 2026-08-04

**Ajanda, macOS Takvim'e benzer bir arayüze yükseltildi:** Sayfaya sol tarafta gün noktalarıyla (o gün etkinlik varsa renkli nokta gösteren) gezinilebilir bir mini ay takvimi ve tıklanınca ana takvimi o türün etkinliklerini gizleyip gösteren renkli "Takvimler" listesi (Kongre/Ödeme Vadesi/Hatırlatma, her birinin yanında sayısı) eklendi. Ana takvime Hafta ve Gün görünümleri (önceden yalnızca Ay vardı, `@fullcalendar/timegrid` zaten kurulu ama kullanılmıyordu) ve bunlar arasında macOS'un segmented control'üne benzer bir görünüm anahtarı eklendi. Bugünün tarihi artık kırmızı daire içinde vurgulanıyor (mini takvimde ve ay görünümünde). Mevcut tıklama/tooltip/renk-kodlama davranışı ve veri kaynağı (kongreler, ödeme vadeleri, hatırlatmalar) değişmedi. Şema değişikliği yok.

## [2.14.4] - 2026-08-04

**Kök neden düzeltmesi — geniş tablolar (Cari Kart dahil) artık taşmıyor:** `Card` bileşeni `flex flex-col` olduğu için, içindeki `CardContent` (ve dolayısıyla çok sütunlu bir tablo) `min-w-0` olmadan kendi içeriğinin doğal genişliğinden küçülmeyi reddedip kartın kendisini (ve sayfayı) sağa doğru taşırıyordu — Cari Kart tablosundaki sağdaki "Cari Hesap" sütunu bu yüzden ekran kenarından taşıp görünmez oluyordu. `Card` ve `CardContent`'e `min-w-0` eklendi — bu paylaşılan bileşen olduğu için tüm uygulamadaki benzer geniş tablo/kart kullanımlarını (sadece Cari Kart değil) aynı anda düzeltiyor; tablo artık kendi içinde yatay kaydırılabiliyor, taşmıyor. Şema değişikliği yok.

## [2.14.3] - 2026-08-04

**"Kongreye Götürülen Ürün" iki bağlı alt panele ayrıldı:** Üstte "Kongreye Götürülen Ürün" (götürülüp bekleyen/geri dönen), altında ayrı bir panel olarak **"Kongrede Kullanılan Ürün"** — ikisi de gerçek stokla bağlantılı: her ikisine eklenen ürün stoktan düşüyor. Götürülen listesindeki bir ürün "Kullanıldı İşaretle" ile alt panele taşınabiliyor (ek stok hareketi gerekmez, zaten dışarıda), ya da "Kullanılan Ürün Ekle" ile doğrudan alt panele eklenebiliyor (bu durumda stoktan yeni düşülür). "Geri Döndü" işaretlenen ürün stoğa iade ediliyor. Şema değişikliği yok.

## [2.14.2] - 2026-08-04

**"Kalan / Kullanılmayan Ürünler" bölümü kaldırıldı, "Kongreye Götürülen Ürün" onun yerini aldı:** Eski bölüm artık gereksizdi çünkü yeni ürün takibi paneli (Götürüldü/Kullanıldı/Geri Döndü) aynı işi zaten daha iyi yapıyordu — panel "Kongreye Götürülen Ürün" olarak yeniden adlandırıldı, başlığında artık kaç üründe kaç adet kullanıldığı da (yeşil rozet) ayrıca gösteriliyor. Kullanılmayan `RemainingProductDialog` bileşeni ve ilgili hook'lar temizlendi — kod tekrarı kalmadı. Eski verinin durduğu tablo (`congress_remaining_products`) veritabanında dokunulmadan duruyor, hiçbir kayıt silinmedi. Şema değişikliği yok.

## [2.14.1] - 2026-08-04

**Ürün ve Sarf Malzeme takibi iki ayrı bölüme ayrıldı:** "Ürün Takibi (Stoktan)" artık sadece gerçek stok ürünlerini kapsıyor (Götürüldü/Kullanıldı-Satıldı/Geri Döndü). Yeni **"Sarf Malzeme"** bölümü ayrı — stokla bağlantısız, serbest metinle tek tek eklenen (eldiven, gazlı bez, iğne, kanül vb.) malzemeler, her biri adet + kullanıldı işaretiyle takip ediliyor. "Standart Listeyi Ekle" ile hazır 20 maddelik cerrahi/estetik sarf malzeme paketi tek tıkla eklenip adetler sonradan düzenlenebiliyor. Yeni `congress_consumables` tablosu eklendi — **bu bölümün çalışması için güncellenmiş `supabase/schema.sql`'in Supabase SQL editöründe çalıştırılması gerekiyor.**

## [2.14.0] - 2026-08-04

**Kongre/Workshop detay sayfasına "Ürün ve Sarf Malzeme Takibi" eklendi:** Kongreye/workshopa götürülen her ürün tek bir listede — eklenirken gerçek stoktan düşülüyor (record_stock_movement RPC'siyle). Her satırın durumu değiştirilebiliyor: **Götürüldü (Bekliyor) / Kullanıldı-Satıldı / Sarf Edildi / Geri Döndü** — "Geri Döndü" seçilince stoğa otomatik iade ediliyor, tekrar başka duruma alınırsa stoktan tekrar düşülüyor; satır silinirken de stok tutarlılığı korunuyor. Etkinlik bitmiş ama hâlâ "Götürüldü" durumunda kalan (yani hesabı kapanmamış) ürünler varsa panel başlığında uyarı rozeti çıkıyor ve bu durum artık **Bildirimler/uyarılar sisteminde de** (üst çubuk zil menüsü, Hatırlatmalar sayfası, Ana Panel Bildirimler kartı) görünüyor. Doktora özel "Aldığı Ürünler" satış takibi ve mevcut "Kalan/Kullanılmayan Ürünler" listesi olduğu gibi korundu, hiçbir şey bozulmadı — bu yeni panel genel envanter/sarf kontrolü için ek bir katman. Yeni `congress_stock_items` tablosu eklendi — **bu özelliğin çalışması için güncellenmiş `supabase/schema.sql`'in Supabase SQL editöründe çalıştırılması gerekiyor.**

## [2.13.6] - 2026-08-04

**Örnek veri görselleri artık gerçek Lucide çizgisel ikonlar (emoji değil):** Renkli/karakter-fontuna bağlı emoji glifleri yerine, uygulamanın kendi ikon setinden alınmış çizgisel (stroke, dolgu yok) SVG path'leri aynı gradyan+cam parlaklığı zemininde render ediliyor — temsilciler `UserRound`, ürünler ilgili ikon (Syringe/Droplet/FlaskConical/TestTube), kongre `Presentation`. Artık işletim sistemine göre değişmiyor, tamamen "çizgisel/kurumsal" duruyor.

**Ana Panel özet kartlarında Tahsilatlar yerine Araçlar:** İlk sıradaki 5 kart artık Toplam Satış / **Araçlar** (araç sayısı + aylık kiralama + bu ayki yakıt gideri toplamı, gerçek yakıt kayıtlarından sparkline) / Toplam Cari / Aktif Temsilci / Stokta Ürün. Tahsilat verisi panelden tamamen kalkmadı — "Tahsilat Hedefi" göstergesi hâlâ orta sırada duruyor. Şema değişikliği yok.

## [2.13.5] - 2026-08-04

**Örnek veri emoji görselleri daha kurumsal görünecek şekilde yenilendi:** Düz tek renkli daire yerine, Ana Panel'deki Hızlı İşlemler ikonlarıyla aynı "premium" tasarım dili kullanılıyor artık — diyagonal gradyan zemin, üstte ince cam parlaklığı, squircle köşe ve hafif kenarlık. Renk paleti de marka renkleriyle (oklch) tutarlı hale getirildi. **Not:** Daha önce "Örnek Veri Ekle" ile oluşturulmuş kayıtlar eski düz renkli görseli korur — yeni stili görmek için Ayarlar'dan önce "Örnek Verileri Sil", sonra tekrar "Örnek Veri Ekle" yapmanız gerekir. Şema değişikliği yok.

## [2.13.4] - 2026-08-04

**Özet kartlardaki metin ezilmesi bu kez gerçek piksel hesabıyla düzeltildi:** Önceki eşik (210px) sparkline'ın tam açıldığı noktada metne sadece ~22px bırakıyordu — kart genişliği eşiği ile sparkline+ikon+boşluk toplamı çakışıyordu. Izgara tabanı 200px'ten 260px'e, sparkline gösterme eşiği 210px'ten 350px'e çıkarıldı (her ikisi de gerçek piksel hesabıyla: ikon 44 + boşluk 12 + kart iç boşluğu 48 + okunabilir metin için en az 120-150px).

**Örnek Veri Ekle artık her modülü kapsıyor, küçük görseller de ekliyor:** Ayarlar > Örnek Veri Ekle'ye eksik olan Araçlar (1 araç + 1 yakıt kaydı) ve Instagram Doktor Listesi (2 kayıt) eklendi — artık panelde boş/eksik görünen bölüm kalmıyor. Ayrıca örnek satış temsilcilerine emoji tabanlı (👨‍💼👩‍💼🧑‍💼) renkli "fotoğraf", örnek ürünlere ürünle ilgili emoji (💉💧🧴🩸) ve örnek kongreye 🎤 görseli otomatik atanıyor — hepsi ağ isteği gerektirmeyen yerel SVG data-URI, gerçek fotoğraf yerine geçmiyor, sadece panel boş kutucuklarla dolu görünmesin diye. Örnek Verileri Sil bu yeni kayıtları da temizliyor. Şema değişikliği yok.

## [2.13.2] - 2026-08-04

**Ana Panel'deki Satış Temsilcisi Raporu artık gerçek temsilci fotoğrafını gösteriyor:** Temsilciye "Temsilciyi Düzenle"den fotoğraf yüklenmişse, Ana Panel'deki kart da (Satış Temsilcisi Raporu sayfasıyla aynı şekilde) o fotoğrafı gösteriyor; yoksa isme göre renkli baş harf rozeti kalıyor. Şema değişikliği yok.

## [2.13.1] - 2026-08-04

**Araçlar > Son Yakıt Kayıtları tablosuna Plaka ve Temsilci sütunları eklendi:** Yakıt kaydı eklenirken sadece tarih (gün/ay/yıl, elle değiştirilebilir) ve tutar giriliyor — o araca atanmış plaka ve satış temsilcisi adı artık ayrıca elle girilmeden, araç kaydından otomatik çekilip tabloda gösteriliyor. Tarih gösterimi tam ay adıyla (ör. "4 Ağustos 2026") yapılıyor. Şema değişikliği yok.

## [2.13.0] - 2026-08-04

**Yeni modül: Araçlar (şirket araç/kiralama/yakıt takibi):** Sol menüye "Araçlar" eklendi. Her araç için: model/yıl, plaka, ruhsat bilgileri, hangi firmadan alındığı, kullanan satış temsilcisi, aylık kiralama fiyatı, bakım tarihi ve UTTS var/yok (onay kutusu) kaydediliyor. Ayrıca her araca günlük olarak eklenebilen bir yakıt yükleme kaydı (tarih + tutar + not) var; sayfanın altında son yakıt kayıtları ayrı bir tabloda listeleniyor. Excel/Word/PDF dışa aktarma diğer sayfalarla aynı mekanizmayı kullanıyor. Yeni `vehicles` ve `vehicle_fuel_logs` tabloları eklendi (shared-trust RLS, diğer tablolarla aynı desen) — **bu modülün çalışması için güncellenmiş `supabase/schema.sql`'in Supabase SQL editöründe çalıştırılması gerekiyor.**

## [2.12.106] - 2026-08-04

**"Doktor Bazlı Satış Performansı" yerine "Satış Temsilcisi Raporu" kartı:** Ana Panel'deki liste, doktor bazında değil temsilci bazında bu ayki ciroyu gösteriyor artık — "Satış Temsilcisi Raporu" (/doktor-ziyaretleri) sayfasındaki "Bu Ay Ciro" ile AYNI tanımı kullanıyor (temsilciye bağlı tahsilatlar, bu ay), böylece iki yerde farklı rakam görünmüyor. Sadece cirosu olan değil, TÜM aktif temsilciler listeleniyor (cirosu olmayan 0 ₺ ile) — liste boş görünmesin diye ama uydurma rakam yok. Kullanılmayan `DoctorPerformanceCard` bileşeni kaldırıldı. Şema değişikliği yok.

## [2.12.105] - 2026-08-04

**Özet kart satırının pencere yeniden boyutlanınca titreyen/değişen düzeni düzeltildi + görsel içerikler genişletildi:** Toplam Satış/Tahsilatlar/Toplam Cari/Aktif Temsilci/Stokta Ürün satırı, sabit sütun sayısı kırılma noktaları (`grid-cols-2/3/5`) yerine `repeat(auto-fit, minmax(200px, 1fr))` kullanmaya geçti — önceki yöntemde 5 sütuna geçildiğinde her kart aslında 3 sütunluyken olduğundan DAHA DAR oluyordu (satır genişliği daha çok karta bölündüğü için), bu da sparkline'ın görünüp kaybolmasına ve metnin "titreşmesine" yol açıyordu; artık her kart en az 200px garanti, pencere büyüdükçe kartlar sadece büyüyor, asla küçülmüyor. Ayrıca: "En Çok Satan Ürünler" artık ürünün gerçek görseli varsa onu gösteriyor; "Bildirimler" kartı ürün/kongre ile ilgili uyarılarda o ürünün/kongrenin gerçek görselini gösteriyor; gerçek görsel olmayan ürün/kongre/doktor/temsilci satırlarında artık tek düze gri yerine isme göre sabit (rastgele değil, her açılışta aynı) bir renk kullanılıyor — panel daha dolu/canlı görünüyor ama hiçbir yerde uydurma fotoğraf/rakam yok. Şema değişikliği yok.

## [2.12.104] - 2026-08-04

**Ana Panel özet kartlarındaki metin ezilme hatası düzeltildi + veri az olduğunda kartlar boş görünmesin diye gerçek veri penceresi genişletildi:** Toplam Satış/Tahsilatlar/Toplam Cari kartlarında sabit genişlikli sparkline grafiği, dar kartlarda etiket/tutar metniyle aynı alanı paylaşınca metni tek karaktere kadar sıkıştırıyordu ("T", "1" gibi anlaşılmaz kısaltmalar). Artık her kart kendi container query'siyle dar olduğunda sparkline'ı gizleyip alanı tamamen metne bırakıyor; etiket/tutar üstüne gelince tam metni gösteren `title` eklendi. Ayrıca "En Çok Satan Ürünler" ve "Doktor Bazlı Satış Performansı" artık sadece içinde bulunulan takvim ayı yerine son 90 günlük gerçek satış verisine bakıyor (başlıkta "Son 90 gün" etiketiyle belirtiliyor) — bu ay için henüz az veri girilmişse liste boş görünmesin diye. "Tahsilat Hedefi" de bu ay için hedef girilmemişse, o yıl içinde girilmiş en yakın gerçek hedefi "(bu ay girilmedi)" etiketiyle gösteriyor; hiçbiri yoksa yine uydurma rakam göstermeden Bütçe Yılı'na yönlendiriyor. Şema değişikliği yok.

## [2.12.103] - 2026-08-04

**Sabit Görünüm liste kartlarındaki (En Çok Satan Ürünler, Doktor Bazlı Satış Performansı, Bildirimler, Yaklaşan Kongreler, Tahsilat Hedefi) kalan taşma noktaları giderildi:** Bir önceki düzeltme sayfa/sütun düzeyindeki taşmayı çözmüştü ama bu kartların kendi satır bileşenlerinde (`flex items-center ...`) `min-w-0` eksikti — flex satırı, CardContent'in grid'inde bir hücre olarak kendi içeriğinin doğal genişliğinden küçülmeyi reddedip dar pencerede kartın kendi kenarlarından taşabiliyordu. Her liste kartındaki satır ve CardContent grid'ine `min-w-0` eklendi, Tahsilat Hedefi'ndeki tutar metnine `break-words` eklendi. Şema değişikliği yok.

## [2.12.102] - 2026-08-04

**Ana Panel'deki taşma/kayma sorununun asıl kök nedeni bulundu ve düzeltildi:** `AppShell`'de TopBar+sayfa içeriğini saran flex sütununda (`flex flex-1 flex-col`) `min-w-0` eksikti — flexbox'ın "içerik kadar küçülmeme" varsayılanı yüzünden, içerideki herhangi bir kart/tablo küçülmeyi reddettiğinde bu genişlik yukarı taşıyıp tüm içerik alanını pencereden geniş yapabiliyor, dıştaki `overflow-hidden` bunu sessizce kırpınca ekranda başka bir sütunun ince bir dilimi gibi görünen kaymalar oluşuyordu. Artık bu sütun ve `<main>` `min-w-0` + `overflow-x-hidden` alıyor, dolayısıyla iç bileşenlerden biri hâlâ dar kalırsa bile taşma pencere dışına/komşu alana sızmıyor. Ayrıca Sabit Görünüm'deki 3 kart satırı artık pencere genişliğine göre değil (sidebar payını hesaba katmayan Tailwind `sm/lg/xl` viewport breakpoint'leri yanlış tetikleniyordu), CSS **container query**'lerle (`@container`, `@[420px]:` vb.) gerçek içerik alanı genişliğine göre sütun sayısını belirliyor. Şema değişikliği yok.

## [2.12.101] - 2026-08-04

**Sabit Görünüm istatistik kartları, pencere tam ekran değilken de taşmasın diye sağlamlaştırıldı:** Önceki düzeltme kartların taşmasını tam ekran genişlikte çözmüştü ama 5 sütunun aniden devreye girdiği ~1024px genişlik civarında (pencere küçültülünce) kartlar hâlâ sıkışıp taşabiliyordu — kök neden, mini grafiğe (`Sparkline`) verilen sabit 72px'in `shrink-0` ile büzülmeye kapatılması ve kart içindeki flex satırının kendi `min-w-0` almamasıydı (flexbox'ın "içerik kadar küçülmeme" varsayılanı yüzünden satır, kartın gerçek genişliğinden daha fazla yer istiyordu). Şimdi satır `min-w-0` alıyor, mini grafik gerekirse büzülüp kırpılıyor (taşmıyor), ve üst istatistik satırı 2 sütundan 5 sütuna tek sıçrama yerine `lg` (1024px) ara adımda 3 sütun üzerinden geçiyor. Şema değişikliği yok.

## [2.12.100] - 2026-08-04

**Sabit Görünüm'de üst istatistik kartlarındaki taşma/kayma düzeltildi:** İstatistik kartlarındaki mini grafikler (`Sparkline`) `ResizeObserver` tabanlı `ResponsiveContainer` yerine sabit piksel boyut kullanacak şekilde değiştirildi — bazı durumlarda mini grafiğin kutunun dışına taşmasına neden olan ölçüm belirsizliği ortadan kalktı. Kart değeri/etiketi artık taşarsa 2 satıra kayıp kartı uzatmak yerine tek satırda kısaltılıyor (`truncate`), kartların kendisi `overflow-hidden` aldı. Satış Performansı grafiğinde Y eksenine üst boşluk eklendi, tepe noktası artık eksen etiketlerine değmiyor. Şema değişikliği yok.

## [2.12.99] - 2026-08-04

**Sidebar logosunun altındaki "Medikal Estetik" yazısı kaldırıldı:** Logo başlığında artık sadece `ElffarmaLogo`'nun kendi taglinesi ("Estetik Sanatı") görünüyor. Şema değişikliği yok.

## [2.12.98] - 2026-08-04

**Sidebar logosunun arkasındaki beyaz kutu kaldırıldı:** `AppShell` sol menü başlığındaki logo alanı, temadan bağımsız sabit bir açık renk (`oklch(0.98 0.006 75)`) arka plana sahipti — bu yüzden hangi marka rengi/koyu-açık mod seçilirse seçilsin logonun arkası hep beyazımsı görünüyordu. Sabit arka plan kaldırıldı, logo artık sidebar'ın kendi arka planı üzerinde `ElffarmaLogo`'nun `premium` varyantıyla (`text-sidebar-foreground` tabanlı, zaten koyu/renkli zeminler için tasarlanmıştı) render ediliyor — böylece seçili marka temasının rengini alıyor. Şema değişikliği yok.

## [2.12.97] - 2026-08-04

**Günlük Hareket içe aktarmaya geçici hata ayıklama logları eklendi:** İçe aktarma akışının hangi adımda beklenmedik davranış gösterdiğini teşhis edebilmek için matris/başlık/satır/özet aşamalarına konsola (`console.error`) debug çıktısı eklendi. Kullanıcıya görünen davranışta değişiklik yok. Şema değişikliği yok.

## [2.12.96] - 2026-08-03

**Dashboard + sol menü/üst bar, referans ekran görüntüsüne göre pixel-perfect yeniden tasarlandı:** Ana Panel'e, mevcut sürükle-bırak widget sistemi korunarak (Ayarlar'dan "Özelleştirilebilir Görünüm" ile hâlâ erişilebilir) YENİ bir sabit "Sabit Görünüm" eklendi ve varsayılan yapıldı: sparkline'lı 5 özet kart (Toplam Satış/Tahsilatlar/Toplam Cari/Aktif Temsilci/Stokta Ürün), tooltip'li Satış Performansı çizgi grafiği, Bütçe Yılı hedefleriyle beslenen dairesel "Tahsilat Hedefi" göstergesi, Yaklaşan Kongreler/En Çok Satan Ürünler/Doktor Bazlı Satış Performansı/Bildirimler kartları ve düz ikon+etiket "Hızlı İşlemler" satırı — tümü gerçek verilerle (uydurma sayı yok). Sol menü ve üst bar da görsele göre yeniden düzenlendi: sidebar'a beyaz logo başlığı ve kullanıcı profil kartı (avatar/ad/rol/çevrimiçi) eklendi; üst bara yapay zeka sohbetini açan sohbet ikonu (daha önce yarım bırakılmış `useAIChatOpen` altyapısı tamamlandı), koyu/açık tema butonu (sidebar'dan taşındı) ve klinik adı eklendi. Varsayılan marka teması Siyah/Gold'dan Kırmızı'ya çevrildi (Siyah/Gold dahil diğer 9 tema hâlâ Ayarlar'dan seçilebilir). Cari Hesap toplam bakiye hesabı ile Dashboard'daki "Toplam Cari" kartı artık aynı paylaşılan `cariLedger` mantığını kullanıyor (önceden Dashboard basitleştirilmiş/hatalı bir rakam gösteriyordu). Şema değişikliği yok.

## [2.12.95] - 2026-08-02

**Denetim raporundan çıkan tutarsızlıklar düzeltildi:** Uygulama genelinde yapılan bir tutarlılık denetiminde bulunan iki gerçek eksiklik giderildi — tahsilat fatura bilgisi kaydetme ve Günlük Sayım'ı başlatma/tamamlama/yeniden açma artık diğer tüm yazma işlemleri gibi bağlantı koptuğunda kuyruğa alınıp otomatik gönderiliyor (önceden bağlantı yoksa direkt hata veriyorlardı). Ayrıca `database.ts`'e eksik olan `Customer.birth_date` alanı eklendi (veritabanında var ama uygulamanın tip tanımında yoktu). Diğer denetim bulguları (kullanılmayan eski `appointments` tablosu gibi) zararsız/kozmetik olduğu için dokunulmadı. Şema değişikliği yok.

## [2.12.94] - 2026-08-02

**Günlük Özet sadeleştirildi — toplam/fark rakamları kaldırıldı, ürünler Dermakor/Swiss diye ayrıldı:** Görsel karttaki Toplam Ürün/Sistemdeki Stok/Sayılan/Fark rakamları kaldırıldı. Excel/Word/PDF/PNG çıktısı artık sadece tarih/gün başlığıyla başlayıp ürünleri "DERMAKOR" ve "SWİSS" olarak iki ayrı bölümde listeliyor (ürün hattı boş olanlar varsa ayrı bir "DİĞER" bölümünde). Şema değişikliği yok.

## [2.12.93] - 2026-08-02

**Günlük Özet çıktılarına (Excel/Word/PDF/PNG) kalem kalem ürün listesi eklendi:** Önceden sadece 4 toplam rakamı içeren Günlük Özet dışa aktarma artık toplamların altında her ürünün adını ve o günkü son (sistemdeki) adedini de listeliyor — Excel/Word/PDF'te "— ÜRÜN BAZINDA —" ayracıyla, PNG görselinde ayrı bir tablo bölümü olarak. Şema değişikliği yok.

## [2.12.92] - 2026-08-02

**Günlük Sayım'a "Günlük Özet" kartı eklendi (Excel/Word/PDF/Yazdır/PNG):** Sayım tablosunun hemen altına, gün içindeki eklemeler/düşümlerden sonraki son durumu özetleyen bir kart eklendi (toplam ürün, toplam sistemdeki stok, toplam sayılan, toplam fark) — "Sistemdeki Miktar" üzerinden stok eklendikçe canlı güncelleniyor. Mevcut Excel/Word/PDF/Yazdır menüsüne ek olarak, kullanıcının istediği "resim" formatı için yeni bir PNG dışa aktarma eklendi (Canvas ile çizilip indiriliyor, ek kütüphane gerekmedi). Şema değişikliği yok.

## [2.12.91] - 2026-08-02

**Günlük Sayım'a "Yeniden Aç" eklendi:** Kök neden bulundu — "Sistemdeki Miktar" üzerine tıklayıp stok ekleme özelliği, sayım "Tamamlandı" durumundayken (salt-okunur) çalışmıyordu, bu normal/istenen davranış ama kullanıcı bunu fark edemiyordu. Artık "Tamamlandı" rozetinin yanında bir "Yeniden Aç" butonu var — sayımı tekrar düzenlenebilir hale getirip stok ekleme/sayılan girme işlemlerine devam edilebiliyor. Şema değişikliği yok.

## [2.12.90] - 2026-08-02

**Günlük Sayım'da "Sistemdeki Miktar" üzerine tıklayıp stok ekleyebilme:** Sayım tablosundaki her ürünün sistemdeki miktarına tıklayınca küçük bir giriş alanı açılıyor — girilen sayı kadar stok ekleniyor/düşülüyor (record_stock_movement RPC'siyle denetim kaydı bırakılarak), aynı zamanda o günün referans miktarı da güncellenip "Fark" hesaplaması gün sonuna kadar doğru kalıyor. Şema değişikliği yok.

## [2.12.89] - 2026-08-02

**Günlük Hareket içe aktarma, temsilci/doktor sütunu olmayan sade bir liste (sadece ÜRÜN ADI + STOKLAR) yüklendiğinde artık hata vermiyor:** Önceden dosyada hiç kişi sütunu yoksa "Doktor/temsilci sütunu bulunamadı" hatasıyla tamamen durup hiçbir şey işlemiyordu. Artık bu durumda sadece bir önceki sürümde eklenen STOKLAR eşitleme adımı çalışıyor — yani salt ürün+stok listesi de yüklenip stoklar güncellenebiliyor, kişi bazlı hareket olmadan. Şema değişikliği yok.

## [2.12.88] - 2026-08-02

**Günlük Hareket içe aktarmada Excel'deki "STOKLAR" değeri artık gerçekten stoğa işleniyor:** Önceden bu sütun sadece satır tespiti için kullanılıyor, değeri hiçbir yere yazılmıyordu — özellikle yeni otomatik oluşturulan (0 stoklu) ürünlerde Excel'deki gerçek miktar sisteme hiç yansımıyordu. Artık ürünün sistemdeki mevcut miktarı Excel'deki "STOKLAR" değerinden farklıysa, aradaki fark bir düzeltme hareketi olarak kaydedilip stok o değere eşitleniyor. Şema değişikliği yok.

## [2.12.87] - 2026-08-02

**Günlük Sayım'a basit "Başlangıç Listesi" (ÜRÜN ADI / STOKLAR) dışa aktarma eklendi:** Günün başında, henüz temsilci dağıtımı girilmeden, sadece ürün adı ve mevcut stok miktarını gösteren sade bir tablo (Excel/Word/PDF/Yazdır) — tam gün sonu pivot tablosundan (temsilci sütunları + kalan stoklar) ayrı, "Başlangıç Listesi" butonuyla. ExportMenu artık birden fazla kullanıldığı sayfalarda ayırt edilebilmesi için özelleştirilebilir buton metni (triggerLabel) destekliyor. Şema değişikliği yok.

## [2.12.86] - 2026-08-02

**"Instagram Doktor Listesi" eklendi (manuel giriş):** Yeni bir nav sayfası — Instagram'da bulunan doktorları isim/telefon/e-posta/adres/Instagram kullanıcı adı ile elle kaydedip Excel/Word/PDF/Yazdır ile dışa aktarabileceğiniz basit bir liste. Instagram'ın sayfasını otomatik tarayıp kişilerin iletişim bilgilerini toplama YOK — bu hem Instagram'ın kullanım şartlarına hem KVKK'ya aykırı olur, bu yüzden bilinçli olarak sadece elle giriş destekleniyor. Şema değişikliği: yeni `instagram_leads` tablosu (shared-trust RLS).

## [2.12.85] - 2026-08-02

**Günlük Hareket içe aktarma, genel stokta olmayan ürün yüzünden artık veriyi atlamıyor:** Excel'deki bir ürün adı Stok listesinde henüz kayıtlı değilse, önceden o satır "ürün bulunamadı" hatasıyla atlanıyordu — artık ürün otomatik olarak (varsayılan birim/kritik eşikle) oluşturulup hareket yine de işleniyor; detaylar sonradan Stok sayfasından düzenlenebilir. Şema değişikliği yok.

## [2.12.84] - 2026-08-02

**Günlük Hareket Excel içe aktarma, kullanıcının gerçek şablonunu artık okuyor:** "Günlük Hareket Yükle (Excel)" özelliği, "ÜRÜN ADI" ve "kalan stoklar" gibi iki satırı kapsayan (dikey birleştirilmiş) başlık hücreleri içeren gerçek şablonu tanımıyordu — başlık tespiti düzeltildi. Ayrıca bir sütun başlığındaki isim sistemde kayıtlı bir doktor/temsilci ile eşleşmezse artık hata verip o satırı atlamıyor; yine de düz bir stok hareketi olarak işleniyor (stok doğruluğu önce geliyor). Şema değişikliği yok.

## [2.12.83] - 2026-08-02

**Günlük Sayım dışa aktarma kullanıcının gerçek tablo formatına uyarlandı, Stok'a "Tüm Ürünleri Sıfırla" eklendi:** Günlük Sayım'ın Excel/Word/PDF/Yazdır çıktısı artık kullanıcının kullandığı gerçek format ile birebir aynı — ürün satırları, önceki sayım tarihindeki "STOKLAR" sütunu, o günün tarihi altında o gün satış yapan HER temsilci için ayrı bir sütun (o temsilcinin o üründen dağıttığı adet) ve sonda "kalan stoklar" sütunu (Excel'de gerçek birleştirilmiş başlık hücreleriyle). Stok sayfasına, her ürün için denetim kaydı bırakan bir "çıkış" hareketiyle (doğrudan veritabanı güncellemesi değil) tüm ürünlerin stoğunu 0'a çeken, onay istemli "Tüm Ürünleri Sıfırla" butonu eklendi. Şema değişikliği yok.

## [2.12.82] - 2026-08-02

**Dışa Aktar menüsüne "Yazdır" eklendi, Hazırlık Kontrol Listesi ve Günlük Sayım'a dışa aktarma eklendi:** Paylaşılan `ExportMenu` bileşenine (Excel/Word/PDF'in kullanıldığı her ekranda otomatik) bir "Yazdır" seçeneği eklendi — PDF olarak oluşturup doğrudan tarayıcının yazdırma diyaloğunu açıyor, ayrıca dosya indirmeye gerek kalmıyor. Kongre/workshop Hazırlık Kontrol Listesi ve Stok > Günlük Sayım ekranlarına da aynı Excel/Word/PDF/Yazdır menüsü eklendi. Cari Kart ve Tahsilatlar zaten bu menüyü kullandığı için oradaki "Yazdır" seçeneği otomatik olarak devreye girdi. Şema değişikliği yok.

## [2.12.81] - 2026-08-02

**Kongre kontrol listesine standart şablon eklendi, eksik hazırlıklar uyarı olarak gösteriliyor:** Bir kongre/workshop'un hazırlık kontrol listesi boşsa artık "Standart Listeyi Ekle" butonuyla genelde ihtiyaç duyulan maddeler (stand, numune, broşür, konaklama, ulaşım, ekipman vb.) tek seferde eklenebiliyor — serbest madde ekleme özelliği aynen duruyor. Kongre tarihi 14 gün içine girdiğinde, kontrol listesi hiç doldurulmamışsa veya tamamlanmamış maddesi varsa bu artık bildirim ziline, Hatırlatmalar sayfasına ve Dashboard'daki Kritik Uyarılar kartına otomatik uyarı olarak düşüyor. Şema değişikliği yok (mevcut congress_checklist_items tablosu kullanılıyor).

## [2.12.80] - 2026-08-02

**Dashboard'a otomatik "Yapay Zeka Uyarıları" widget'ı eklendi:** Ana panele, mevcut AIService/işletme özeti altyapısını kullanan yeni bir kart eklendi — sayfa her açıldığında (15 dakikada bir tazelenerek) yapay zeka güncel veriye (kritik stok, SKT, tahsilat riski, CRM, kongreler vb.) bakıp eksik/tutarsız görünen veya önemli olan kısa uyarı/hatırlatma maddeleri çıkarıyor; manuel "Yenile" butonu ve tam analiz sayfasına (Yapay Zeka Analiz) kısayol içeriyor. Önceden bu analiz sadece o sayfada elle tetiklenebiliyordu; artık ana panelde otomatik/pasif olarak görünüyor. AI sağlayıcısına ulaşılamazsa kart bunu açıkça belirtiyor, başka bir yeri etkilemiyor. Şema değişikliği yok.

## [2.12.79] - 2026-08-02

**Stok içe aktarma artık ya hep ya hiç, Dashboard'da "yaklaşıyor" rozetleri yanıp sönüyor:** Stok'ta (hem şablonlu hem Akıllı İçe Aktar) bir satırda hata varsa (eksik ürün adı, sayı olmayan stok miktarı vb.) artık HİÇBİR ürün eklenmiyor — önce tüm satırlar yazma yapılmadan doğrulanıyor, sadece hepsi geçerliyse kayıtlar oluşturuluyor; böylece "15 doğru 1 hata" gibi karışık/kısmi bir sonuç yerine ya tam liste eklenir ya da hiçbiri eklenmez, hatalar düzeltilip yeniden denenebilir. Dashboard'da "Yaklaşan Kongreler" kartındaki "Yaklaşıyor"/"Bugün" rozeti ve "Kritik Uyarılar" kartındaki simgeler artık diğer uyarılar gibi yanıp sönüyor. Şema değişikliği yok.

## [2.12.78] - 2026-08-02

**Kongre görseli yükleme hatası çözüldü, kritik stok uyarıları yanıp sönüyor, Dashboard'da kongre görselleri gösteriliyor:** Kongre/temsilci fotoğrafı yüklerken alınan "new row violates row-level security policy" hatası, yükleme her zaman benzersiz bir yol kullandığı için gereksiz olan `upsert: true` bayrağının kaldırılmasıyla çözüldü (Supabase Storage'ın upsert kod yolu, bu projede fazladan bir RLS kontrolüne takılıyordu). Stok sayfasında kritik stok rozeti/ikonu artık diğer uyarılar gibi yanıp sönüyor. Dashboard'daki "Yaklaşan Kongreler" kartı artık kongrenin yüklenmiş görselini gösteriyor (yoksa eski simge placeholder'ı kalıyor). Şema değişikliği yok.

## [2.12.77] - 2026-08-01

**`storage.buckets` için eksik SELECT politikası eklendi:** Bucket'lar Dashboard'un "New bucket" sihirbazı yerine doğrudan SQL ile oluşturulduğu için `storage.buckets` tablosunda RLS açık kalıp hiçbir politika eklenmemişti — bu, kongre görseli yükleme hatasının olası nedenlerinden biri olarak tespit edildi ve düzeltildi (bucket satırları hassas veri içermediği için herkese salt-okunur erişim açıldı). Görsel yükleme sorunu hâlâ araştırılıyor. Şema değişikliği: `storage.buckets` için yeni `buckets_select_all` politikası.

## [2.12.76] - 2026-08-01

**Akıllı İçe Aktar'da Excel/CSV rakam hatası düzeltildi:** Excel/CSV yüklendiğinde artık satırlar yapay zekaya metin olarak yazdırılıp yeniden "okutulmuyor" — yapay zekadan SADECE hangi sütunun hangi hedef alana karşılık geldiğini (sütun eşlemesi) belirlemesi isteniyor, gerçek değerler koddan doğrudan orijinal Excel satırlarından alınıyor. Bu, küçük yerel modelin (qwen2.5:3b) rakamları yanlış yazma riskini ortadan kaldırıyor. PDF/Word/resim için davranış değişmedi. Şema değişikliği yok.

## [2.12.75] - 2026-08-01

**Yapay zeka destekli "Akıllı İçe Aktar" eklendi (Doktorlar ve Stok):** Mevcut sıkı-şablonlu Excel içe aktarmanın yanına, serbest formatta Word/Excel/PDF/resim yükleyip yapay zekanın içeriği ayrıştırıp yapılandırılmış veriye çevirdiği yeni bir "Akıllı İçe Aktar" özelliği eklendi — kolon başlıklarının tam eşleşmesi gerekmiyor. Yapay zeka çıktısı bir önizleme tablosunda gösteriliyor, kullanıcı onaylamadan HİÇBİR kayıt oluşturulmuyor. PDF metin çıkarımı için `pdfjs-dist`, Word (.docx) için `mammoth` eklendi. Bu ilk sürüm Doktorlar ve Stok sayfalarında aktif; aynı genel amaçlı `SmartImportDialog` bileşeni diğer sayfalara da kolayca eklenebilir. Şema değişikliği yok.

## [2.12.74] - 2026-08-01

**Stok'ta "Sipariş Önerileri" kaldırıldı, ürün adına tıklayınca tam düzenleme açılıyor:** Kritik stok eşiğine göre otomatik sipariş miktarı öneren kart kaldırıldı. Ürün adına tıklayınca artık sadece adet değil, ürünün TÜM bilgilerini (isim, kategori, maliyet/fiyat, kritik eşik vb.) düzenleyebileceğiniz tam form açılıyor — ProductForm artık özel bir tetikleyici (trigger) kabul ediyor. Şema değişikliği yok.

## [2.12.73] - 2026-08-01

**Cari Hesap sayfasından doktor bilgileri düzenlenebiliyor:** Cari Hesap ekstre sayfasına "Bilgileri Düzenle" butonu eklendi — daha önce bu sayfa salt-okunurdu, bilgi güncellemek için Doktorlar sayfasına gitmek gerekiyordu. Şema değişikliği yok.

## [2.12.72] - 2026-08-01

**Kongre/temsilci görselleri artık her çözünürlükte otomatik küçültülüyor:** Yüklenen kongre/workshop görseli ve temsilci fotoğrafı, çözünürlüğü/boyutu ne olursa olsun yüklenmeden önce tarayıcıda en uzun kenarı 480px'i aşmayacak şekilde küçük bir JPEG'e indirgeniyor — büyük orijinal dosyalar olduğu gibi Storage'a atılmıyor. Şema değişikliği yok.

## [2.12.71] - 2026-08-01

**Ajanda'da etkinliklerin üzerine gelince açıklama gösteriliyor:** Hatırlatma/ödeme vadesi/kongre-workshop etkinliklerinin üzerine fare ile gelindiğinde (tıklamadan, sayfa değiştirmeden) tür, başlık ve tarih aralığını gösteren bir tooltip beliriyor. Tıklama davranışı (ilgili sayfaya gitme) aynen korunuyor. Şema değişikliği yok.

## [2.12.70] - 2026-08-01

**Ajanda'da tüm önemli tarihlerin kutucukları renkleniyor:** Daha önce sadece çok günlü kongreler için yapılan takvim kutucuğu boyama, artık hatırlatma ve ödeme vadesi gibi tek günlük etkinlikler için de geçerli — her önemli tarihin kutucuğu türüne göre (kongre/ödeme/hatırlatma) renkle vurgulanıyor. Şema değişikliği yok.

## [2.12.69] - 2026-08-01

**Kongre/workshop'lara hazırlık kontrol listesi eklendi:** Kongre detay sayfasına, tamamen serbest bir "Hazırlık Kontrol Listesi" eklendi — sabit bir madde seti yok, "ne gitmesi/hazırlanması gerekiyorsa" kullanıcı kendisi ekliyor (broşür, roll-up banner, numune kutusu vb.). İşaretlenen madde yeşil tık ile tamamlandı olarak gösteriliyor, tamamlanan/toplam sayısı başlıkta görünüyor. **Not: Bu özelliğin çalışması için güncellenmiş `supabase/schema.sql`'in Supabase SQL editöründe çalıştırılması gerekiyor** (yeni `congress_checklist_items` tablosu).

## [2.12.68] - 2026-08-01

**Ajanda'da yan liste kaldırıldı, yaklaşan etkinlikler takvimin içinde yanıp sönüyor, çok günlü kongreler tüm günleri renkli boyuyor:** Bir önceki sürümde eklenen ayrı "Yaklaşan Etkinlikler" kutusu kaldırıldı — artık tek bir takvim var. Yaklaşan (3 gün içi) veya gecikmiş etkinlikler takvim içinde doğrudan mevcut kırmızı parıltı animasyonuyla (arada bir) yanıp sönüyor. 3-4 gün süren kongre/workshop'lar artık sadece ince bir çubuk değil, kapsadığı TÜM takvim kutucuklarını (background event) marka rengiyle boyayarak süreyi bir bakışta belli ediyor. Şema değişikliği yok.

## [2.12.67] - 2026-08-01

**Ajanda sayfası baştan tasarlandı — artık çok daha anlaşılır:** Takvim + "Yaklaşan Etkinlikler" listesini yan yana gösteren iki kolonlu bir düzene geçildi. Takvimdeki etkinlikler artık küçük renkli ikon rozetleriyle gösteriliyor, `dayMaxEvents` ile kalabalık günlerde "+N daha" bağlantısına toplanıyor (dolayısıyla artık sıkışıp karman çorman görünmüyor). Renkler artık uygulamanın gerçek tema değişkenlerinden (primary/warning/destructive) geliyor. Üstteki tür etiketleri rozet haline getirildi, gecikmiş hatırlatma sayısı ayrı bir "arada parlayan" uyarı rozetiyle vurgulanıyor. Yaklaşan Etkinlikler listesindeki her satır ikon rozeti + "bugün/yarın/X gün sonra" gibi göreli tarih etiketiyle daha "klas" gösteriliyor, gecikmiş hatırlatmalar kırmızı parıltıyla dikkat çekiyor. Şema değişikliği yok.

## [2.12.66] - 2026-08-01

**Kongre/workshop görselleri ve temsilci fotoğrafları artık bilgisayardan yüklenebiliyor:** Kongre formundaki "Görsel URL" alanının yanına tıklanabilir bir önizleme eklendi — tıklayınca bilgisayardan resim seçilip yeni `profile-images` (public) Supabase Storage bucket'ına yükleniyor, kalıcı URL otomatik dolduruluyor. Aynı bucket satış temsilcisi fotoğrafları için de kullanılıyor: Temsilci Ziyaretleri sayfasındaki her temsilci kartının baş harflerinden oluşan rozetine tıklayınca (veya "Temsilci Ekle" formunda) fotoğraf yüklenip temsilcinin adının yanında gösterilebiliyor. **Not: Bu özelliğin çalışması için güncellenmiş `supabase/schema.sql`'in Supabase SQL editöründe çalıştırılması gerekiyor** (yeni `profile-images` bucket'ı ve RLS politikaları içeriyor).

## [2.12.65] - 2026-08-01

**Satış/İade formunda doktor artık combobox'tan hızlıca eklenebiliyor:** Doktor Seç açılır listesinin altına "Yeni Doktor Ekle" seçeneği eklendi — mevcut Yeni Doktor formu (sadece ad soyad + telefon zorunlu, diğer alanlar opsiyonel) açılıyor, kaydedilen doktor otomatik olarak seçili hale geliyor. Bu iyileştirme CustomerCombobox bileşenine eklendiği için Satış'ın yanı sıra Tahsilat, Fatura, Numune, CRM, Prim Kuralı ve Doktor Ziyareti formlarında da aynı şekilde çalışıyor. Şema değişikliği yok.

## [2.12.64] - 2026-08-01

**Koyu modda AI düğmesi/paneli beyaz cam efekti geri alındı:** Bir önceki sürümde eklenen "koyu modda yarı-şeffaf beyaz cam yüzey" davranışı beğenilmedi, geri alındı — AI düğmesi ve sohbet paneli koyu modda yine standart koyu `bg-popover` zeminini kullanıyor. Şema değişikliği yok.

## [2.12.63] - 2026-08-01

**Koyu modda AI düğmesi ve sohbet paneli yarı-şeffaf beyaz cam yüzeye dönüşüyor:** Uygulama koyu temadayken yüzen AI tetikleyici düğmesi ve açılan sohbet paneli artık koyu zemin yerine `bg-white/80`–`/85` + `backdrop-blur-xl` ile yarı-şeffaf beyaz görünüyor; içerideki metin renkleri (mesajlar, zaman damgaları, kenarlıklar) bu alt-ağaçta otomatik olarak açık temanın okunaklı koyu tonlarına dönüyor. Açık modda davranış değişmedi. Şema değişikliği yok.

## [2.12.62] - 2026-08-01

**Kenar Çubuğu Rengi paletindeki "Beyaz / Nötr" artık gerçekten beyaz:** Daha önce bu seçenek koyu tonu koruyup sadece rengi soldurduğu için hâlâ koyu-gri görünüyordu; metin de beyaz kaldığından okunmuyordu. Şimdi "Beyaz / Nötr" seçilince kenar çubuğu gerçekten açık/beyaz oluyor ve yazılar otomatik koyu renge dönüyor (ElffarmaLogo'nun sidebar varyantı da artık sabit beyaz yerine tema değişkenini kullanıyor). Şema değişikliği yok.

## [2.12.61] - 2026-08-01

**Ayarlar > Görünüm'e ayrı Arkaplan ve Kenar Çubuğu renk paletleri eklendi:** Marka renginden bağımsız olarak ana içerik arkaplanı ve sol kenar çubuğu artık kendi renk paletlerinden ayrı ayrı seçilebiliyor ("Varsayılan" seçeneği marka rengini takip etmeye geri döndürür). Şema değişikliği yok (app_settings'te `background_theme`/`sidebar_theme` anahtarları).

## [2.12.60] - 2026-08-01

**Yapay Zeka simgesindeki uydu düğümler artık çekirdeğin etrafında dönüyor:** Üç uydu düğüm + aralarındaki bağlantı çizgileri ve yörünge halkası, saf CSS transform ile (6 saniyede bir tam tur, JS ölçüm yok) çekirdeğin etrafında yavaşça dönüyor; çekirdek sabit kalıyor. Işık huzmesi maskesi artık rotasyondan bağımsız sabit bir daire olduğu için dönerken de düzgün akıyor. Şema değişikliği yok.

## [2.12.59] - 2026-08-01

**Yapay Zeka simgesi daha premium bir görünüme kavuştu:** Düğümler artık radyal gradyanla camsı/mücevher bir küre hissi veriyor (üst-solda parlak highlight, alt-sağda koyu gölge) ve her düğümün üzerinde küçük bir parlak "glint" var; bağlantı çizgileri kırmızıdan uygulamanın marka altınına (gold) geçirildi, çekirdeğin etrafına ince kesikli bir altın "yörünge" halkası eklendi — uygulamanın Siyah/Gold premium tema diliyle uyumlu. Şema değişikliği yok.

## [2.12.58] - 2026-08-01

**Yapay Zeka simgesi "AI" yazısından soyut bir sinir ağı/düğüm simgesine geçirildi:** Harf tabanlı logo yerine, birbirine ince çizgilerle bağlı bir merkez düğüm + üç uydu düğümden oluşan simetrik, gradyanlı bir motif — hiçbir gerçek marka logosunu andırmayan, orijinal bir "yapay zeka/ağ" görseli. Arka plan yine tamamen şeffaf, aynı ambient glow ve arada-bir-parlayan ışık huzmesi animasyonu korunuyor. Şema değişikliği yok.

## [2.12.57] - 2026-08-01

**Yapay Zeka simgesi daha kaliteli bir görünüme kavuştu:** "AI" yazısının arkasına yumuşak, bulanık kırmızı bir ışık taşması (ambient glow) eklendi; gradyan dört durağa çıkarılıp harflere ince koyu bir kontur eklenerek daha mücevher/derinlikli bir görünüm kazandırıldı. Arka plan hâlâ tamamen şeffaf — kutu/daire yok. Mevcut ışık huzmesi animasyonu (arada bir parlama) korunuyor. Şema değişikliği yok.

## [2.12.56] - 2026-08-01

**AI tetikleyicisi yeniden yüzen, sürüklenebilir bir düğmeye dönüştürüldü:** Üst çubuktaki sabit AI ikonu kaldırıldı; yerine ekranın sağ-alt köşesinde duran, sürükleyerek istenilen yere taşınabilen, arada bir yumuşakça yukarı-aşağı süzülen (yeni `animate-ai-button-float` animasyonu) ve üzerinde ışık huzmesi geçen bir yüzen düğme geldi. Tıklandığında (sürüklenmediyse) sohbet paneli düğmenin hemen üstünde açılıyor; panel konumu da düğmenin o anki yerine göre hesaplanıyor. Konum tercihleri (düğme + panel) ayrı ayrı localStorage'da hatırlanıyor. Şema değişikliği yok.

## [2.12.55] - 2026-08-01

**"Yapay Zeka Asistanı" Panel widget'ı kaldırıldı:** AI'nin Panel'de bir çerçeve/kutucuk olarak durması yerine, önceki (üst çubuktaki sabit ikonla açılan, ekranın üzerinde yüzen sürüklenebilir sohbet paneli) davranışı korunuyor — bu widget kaldırıldı, üst çubuktaki AI ikonu ve sohbet paneli değişmeden duruyor. Şema değişikliği yok.

## [2.12.54] - 2026-08-01

**Yapay Zeka Asistanı widget'ı küçük, kare, tek tıkla açılan bir kutucuğa dönüştürüldü:** Önceki metin/butonlu geniş kart yerine, animasyonlu AI ikonunu içeren küçük kare bir kutucuk — tıklanınca doğrudan sohbet panelini açıyor. Diğer tüm widget'lar gibi "Paneli Düzenle" modunda sürükleyerek yeri değiştirilebiliyor. Şema değişikliği yok.

## [2.12.53] - 2026-08-01

**Ana panele animasyonlu "Yapay Zeka Asistanı" widget'ı eklendi:** Panel'de artık büyük, animasyonlu ışıltılı AI simgesiyle yeni bir kart var — "Sohbeti Aç" butonu üst çubuktaki AI sohbet panelini açıyor, "AI Analiz" butonu ilgili sayfaya götürüyor. Varsayılan olarak görünür, "Paneli Düzenle" ile gizlenip boyutu değiştirilebilir. Şema değişikliği yok.

## [2.12.52] - 2026-08-01

**"Temsilci Performansı" widget'ına avatar eklendi, tutarlar kalınlaştırıldı:** Her temsilcinin adının önünde fotoğrafı varsa fotoğrafı, yoksa isim baş harflerinden oluşan bir rozet gösteriliyor. "Satış:" ve "Tahsilat:" tutarları artık kalın (font-semibold). Şema değişikliği yok.

## [2.12.51] - 2026-08-01

**Ayarlar'a 2 yeni premium menü simge seti ve serbest bir renk paneli eklendi:** Menü Simge Seti'ne "Duotone (Premium)" (yumuşak dolgu + kontur) ve "İnce Çizgi (Minimal)" seçenekleri eklendi (artık 5 set: Klasik, Modern, 3D, Duotone, İnce Çizgi). Görünüm kartına, mevcut sabit renk paleti seçeneklerinin yanına, ton (0-359°) ve yoğunluk (%10-100) kaydırıcılarıyla HERHANGİ bir rengi canlı önizleyip "Bu Rengi Uygula" ile kendi isteğiyle uygulayabildiği bir "Özel Renk Paneli" eklendi. Şema değişikliği yok.

## [2.12.50] - 2026-08-01

**Örnek veri artık Klinikler ve CRM'i de kapsıyor:** "Örnek Veri Ekle" iki örnek klinik ve her doktor için bir CRM aktivitesi + bir CRM fırsatı ekliyor — 5 örnek doktor 5 CRM aşamasına (Yeni/Teklif/Müzakere/Kazanıldı/Kaybedildi) birebir dağıtılıyor ki CRM panosunun tüm sütunları dolu görünsün. Bütçe (Yıllık Bütçe) sayfası BİLEREK dışarıda bırakıldı: bütçe hedefleri yıl+ay üzerinden gerçek veriyle aynı hücreye yazıldığından, örnek/gerçek ayrımı yapacak bir etiket yok — otomatik eklemek gerçek bir hedefi sessizce ezme riski taşırdı. Şema değişikliği yok.

## [2.12.49] - 2026-08-01

**Örnek veri artık lot/SKT, kongre paket fiyatı, numune talebi ve prim kuralı da ekliyor:** "Örnek Veri Ekle" özelliği genişletildi — ürünlerden birine SKT'si yaklaşan bir lot, demo kongreye tek/2 kişilik paket fiyatı, her doktor için satılan bir üründen numune talebi (satıştan önceki tarihle, dönüşüm olarak sayılsın diye) ve genel bir prim kuralı (%10, tüm satışlar) ekleniyor. Böylece Panel'deki "Lot / SKT Riski", "Kongre Paket Fiyatları", "Numune Dönüşüm Oranı" ve "Prim Özeti" widget'ları da artık örnek veriyle doluyor — daha önce bu dördü boş kalıyordu. Şema değişikliği yok.

## [2.12.48] - 2026-08-01

**"En Çok Satan Ürünler" artık animasyonlu bir halka (donut) grafik:** Yatay çubuk grafik yerine, ortasında bu ayın toplam cirosunu gösteren, dönerek beliren (Recharts animasyonlu) bir halka grafik ve altında ürün adı/tutarını gösteren renkli bir liste var. Şema değişikliği yok.

## [2.12.47] - 2026-08-01

**Panel kart başlıklarındaki metin çakışması düzeltildi:** "En Çok Satan Ürünler" gibi ikon + başlık + ek etiket (ör. "Bu ay") içeren kart başlıklarında, dar çerçevelerde başlık metni kendi içinde satır kırarken yanındaki etiket yerinde kalıp üst üste biniyordu. Kart başlıkları artık bütün olarak sarıyor (flex-wrap) — sığmayan etiket, metnin ortasına çakışmak yerine temiz şekilde alt satıra düşüyor. Şema değişikliği yok.

## [2.12.46] - 2026-08-01

**Panel'de aynı satırdaki çerçeveler artık aynı yükseklikte, üstten ve alttan hizalı:** Grid hücreleri artık dikeyde geriliyor (stretch) ve içindeki kart bu yüksekliği dolduruyor — daha önce farklı içerik uzunluğuna sahip çerçeveler (ör. "Yaklaşan Hatırlatmalar" ile "En Çok Satan Ürünler") aynı satırda farklı boyda görünüp orantısız duruyordu, şimdi hepsi eşit yükseklikte. Şema değişikliği yok.

## [2.12.45] - 2026-08-01

**Panel'de taşan/kayan yazılar düzeltildi, kutular daha nizami:** Başlık satırı (karşılama yazısı + rozet + düzenle ikonu), kart başlıkları (ikon + "Detaya git" butonu) ve "Temsilci Performansı"/"Prim Özeti" satırları artık dar çerçevelerde de taşmıyor — uzun isimler kısaltılıyor (…), sayılar tek satırda kalıyor, gerektiğinde alt satıra sarıyor. `PageHeader` ve tüm kart başlıkları artık `flex-wrap` ile güvenli.

**Hızlı İşlemler ikonları macOS uygulama simgeleri tarzına geçirildi:** Her ikon artık kendine özgü canlı bir gradyan renkte (mavi/yeşil/mor/turuncu/kırmızı/pembe/gri/turkuaz), üstte cam parlaklığı ve yumuşak gölgeyle "squircle" (yuvarlatılmış kare) bir rozet içinde — macOS Dock/Launchpad ikonlarına benzer bir görünüm. Şema değişikliği yok.

## [2.12.44] - 2026-08-01

**Panel çerçeveleri artık nizami bir kutu ızgarasında, otomatik yerleşiyor:** Widget'lar serbest piksel boyutlandırma yerine 12 sütunlu bir CSS Grid'e (¼/⅓/½/⅔/Tam sütun genişliği seçenekleri) oturuyor; yerleşim `grid-auto-flow: row dense` ile tarayıcı tarafından tamamen otomatik yapılıyor — bir çerçeve gizlenince/küçülünce diğerleri otomatik boşluğa kayıyor, elle "Ekrana Sığdır" tıklamaya gerek kalmadı. Düzenleme modunda kenardan sürükleyerek boyutlandırma yerine her çerçevenin başlığında boyut etiketleri (¼/⅓/½/⅔/Tam) var; sürükleyerek yer değiştirme aynı şekilde çalışmaya devam ediyor. Sürekli JS ölçüm/ResizeObserver kullanılmıyor (bkz. önceki react-grid-layout çökmesi notu).

**Panel'de "Hızlı İşlemler" simgeleri premium ikonlarla değiştirildi:** Fatura Oluştur (Receipt), Tahsilat Ekle (HandCoins), Hatırlatma Ekle (AlarmClockPlus), Prim Hesapla (Calculator), Stok Durumu (Boxes) ikonları daha isabetli/premium seçeneklerle değiştirildi; ikon rozetlerine hafif gradyan + iç/dış gölge (derinlik) eklendi. Şema değişikliği yok.

## [2.12.43] - 2026-08-01

**Panel'de "Hoş geldiniz" yazısı düzenlenebilir, yanına canlı saat ve hava durumu eklendi:** Karşılama başlığının yanındaki kalem ikonuyla (sadece admin) karşılama metni ve hava durumu şehri özelleştirilebiliyor (app_settings'e kaydediliyor). Tarihin yanına her saniye güncellenen bir saat ve seçilen şehir için Open-Meteo üzerinden (API anahtarı gerekmeyen ücretsiz servis) çekilen anlık sıcaklık/hava durumu eklendi. Şema değişikliği yok.

## [2.12.42] - 2026-08-01

**Panel'de "Yaklaşan Hatırlatmalar" widget'ı animasyonlu yanıp sönüyor:** Her hatırlatma satırındaki zil ikonu artık mevcut kırmızı parıltı animasyonuyla (uygulamanın geri kalanında gecikmiş/kritik uyarılar için zaten kullanılan aynı efekt) yanıp sönüyor; vadesi geçmiş hatırlatmaların tarih rozeti de aynı şekilde blink ediyor. Şema değişikliği yok.

## [2.12.41] - 2026-08-01

**Örnek/deneme veri artık daha çok modülü kapsıyor:** Ayarlar'daki "Örnek Veri Ekle" artık doktor/ürün/tahsilat/satışın yanı sıra örnek satış temsilcisi, hatırlatma, kongre, doktor ziyareti ve gider de ekliyor — bu sayede Panel'deki "Temsilci Performansı", "Yaklaşan Hatırlatmalar", "En Çok Satan Ürünler" ve "Yaklaşan Kongreler" gibi widget'lar da örnek veriyle doluyor. Satışların en az biri bu ay içine düşecek şekilde tarihleniyor (aylık widget'lar boş görünmesin diye). Etiket/SKU'su olmayan tablolarda (temsilci/hatırlatma/kongre/ziyaret/gider) işaretleme isim/başlık alanındaki "[Örnek]" öneki ile yapılıyor; "Örnek Verileri Sil" hepsini aynı şekilde geri kaldırıyor. Şema değişikliği yok.

## [2.12.40] - 2026-08-01

**Logo ışıltı animasyonu kaldırıldı, yerine hafif gölge eklendi:** Bir önceki sürümde eklenen harflerin içinden geçen yıldız ışıltısı animasyonu kaldırıldı; "elfFARMA" yazısının arkasına sabit, hafif bir düşen gölge (drop-shadow) eklendi. Büyütülmüş logo boyutu korunuyor. Şema değişikliği yok.

## [2.12.39] - 2026-08-01

**Elffarma logosu büyütüldü, harflerin içinden geçen yıldız ışıltısı animasyonu eklendi:** "elfFARMA" yazı boyutu ve "Estetik Sanatı" alt yazısı biraz büyütüldü (giriş ekranı, şifre sıfırlama ve kenar çubuğu — hepsi aynı bileşeni kullanıyor). Yavaş, arada bir tekrarlayan (6 saniyede bir) dar ve parlak bir ışıltı harflerin şekline kırpılmış olarak (bg-clip-text) belirip kayboluyor — kutunun üzerinden geçen düz bir bant değil, harflerin içinden geçen yıldız parıltısı gibi. Şema değişikliği yok.

## [2.12.38] - 2026-08-01

**Ayarlar'a örnek/deneme veri ekleme:** Panel grafiklerini ve diğer sayfaları gerçek görünümüyle denemek için admin hesaplarına "Ayarlar" sayfasında tek tıkla birkaç örnek doktor, ürün, tahsilat ve satış eklenebiliyor; adları/kodları "[Örnek]" ile işaretleniyor ve aynı yerden tek tıkla tamamen geri silinebiliyor. Silme işlemi önce doktorları kaldırıyor (bağlı tahsilat/satış vb. kayıtlar `on delete cascade` ile otomatik temizleniyor), sonra örnek ürünleri kaldırıyor — gerçek verilere dokunmuyor. Şema değişikliği yok.

## [2.12.37] - 2026-08-01

**Stok sayfasında adet üzerine tıklayarak hızlı düzenleme:** Stok listesindeki her ürünün adet rozetine tıklanınca yerinde (inline) bir sayı kutusu açılıyor; yeni değer onaylanınca fark, `record_stock_movement` RPC'si üzerinden (artışta "adjustment", azalışta "out" hareket tipiyle) kaydediliyor — `products.current_quantity` hiçbir zaman doğrudan güncellenmiyor, stok hareket geçmişi bozulmuyor. Şema değişikliği yok.

## [2.12.36] - 2026-08-01

**AI simgesi artık üst çubukta (wifi/ayarlar/profil ile aynı satırda) sabit duruyor:** Sağ alt köşede sürüklenebilen/gizlenebilen yüzen AI simgesi kaldırıldı — bunun yerine üst çubukta, bağlantı göstergesinin hemen solunda, ayarlar ve profil menüsüyle aynı sırada, daha büyük sabit bir AI ikonu var. Tıklanınca aynı sohbet paneli açılıyor; panel hâlâ sürüklenip yeniden konumlandırılabiliyor ve kenarından boyutlandırılabiliyor, sadece TETİKLEYİCİ ikon artık sabit. Işık huzmesi animasyonu artık sürekli değil, birkaç saniyede bir "arada" parlayacak şekilde ayarlandı. "Ayarlar > Yapay Zeka"daki simgeyi gösterme/gizleme anahtarı kaldırıldı (artık geçerli değil — diğer üst çubuk ikonları gibi her zaman görünür). Şema değişikliği yok.

## [2.12.35] - 2026-08-01

**AI simgesi arka planı tamamen şeffaf hale getirildi, "AI" yazısına premium ışık huzmesi eklendi:** Simgenin arkasındaki daire/kare kaldırıldı — artık sadece kırmızı gradyanlı, kalın "AI" yazısı şeffaf bir arka plan üzerinde duruyor. Animasyonlu halinde harflerin üzerinden parlak bir ışık huzmesi tekrar tekrar geçiyor (premium "buton shine" efekti). Şema değişikliği yok.

## [2.12.34] - 2026-08-01

**AI simgesi renkleri ters çevrildi: kırmızı arka plan, beyaz simge:** Simgenin arkasındaki daire/kare artık kırmızı (marka rengi), önündeki robot-konuşma-balonu çizgileri beyaz; gözler arka planla aynı kırmızı tonda kalıp beyaz kafanın üzerinde "oyulmuş" gibi görünüyor. Şema değişikliği yok.

## [2.12.33] - 2026-08-01

**AI simgesi "konuşma balonu içinde robot yüzü" tasarımına geçirildi:** Kırmızı küre yerine, arka planı şeffaf, mavi tonlarında bir konuşma balonu içinde basit bir robot yüzü (parlayan mavi gözler, yan kulaklar, alt kuyruk) simgesine geçildi. Animasyonlu halinde gözler yumuşakça parlayıp sönüyor, dış halka nefes alır gibi büyüyüp küçülüyor. Şema değişikliği yok.

## [2.12.32] - 2026-08-01

**AI orb simgesine "chat" yazısı ve parıldayan aksan eklendi:** Kırmızı kürenin üstünde "AI", altında "chat" yazısı, ikisinin arasında (animasyonlu halinde) yanıp sönen küçük bir parıltı var; yazı boyutları daha okunaklı olacak şekilde büyütüldü. Şema değişikliği yok.

## [2.12.31] - 2026-08-01

**AI orb simgesi kırmızıya çevrildi + üzerine "AI" yazısı eklendi:** Parıldayan küre artık mavi/mor yerine kırmızı gradyanla (Elffarma marka rengiyle uyumlu) çiziliyor, ortasında beyaz "AI" yazısı var. Şema değişikliği yok.

## [2.12.30] - 2026-08-01

**AI simgesi parıldayan bir "orb" (küre) tasarımına geçirildi:** Önceki "AI" yazılı çerçeve/parıltı yerine, birçok premium AI asistan ürününde (Siri, Copilot vb.) yaygın olan, tek bir şirkete ait olmayan genel bir görsel dil kullanan gradyanlı, parıldayan bir küre simgesine geçildi — en küçük boyutlarda (mesaj avatarı gibi) bile okunaklı. Animasyonlu halinde dış parıltı nefes alır gibi büyüyüp küçülüyor, iç ışık vurgusu yavaşça küre etrafında dönüyor. Şema değişikliği yok.

## [2.12.29] - 2026-08-01

**AI simgesi "AI" yazılı çerçeve tasarımına güncellendi:** Yuvarlak köşeli bir çerçeve içinde "AI" yazısı ve sağ üstte büyük/küçük parıltı aksanından oluşan yeni bir simgeye geçildi (teal-mavi-mor gradyan) — kullanıcının paylaştığı referansla aynı kompozisyon, kendi SVG'imiz ve gradyanımızla çizildi. Ana ekrandaki simge, panel başlığı ve mesaj avatarlarının hepsinde tutarlı şekilde kullanılıyor. Şema değişikliği yok.

## [2.12.28] - 2026-08-01

**Panel'de çerçeveleri yan yana yerleştirmek kolaylaştı + "Ekrana Sığdır" eklendi:** "Paneli Düzenle" modunda bir çerçeveyi sürüklerken artık bırakacağınız yer (hangi çerçevenin yerine geleceği) anlık olarak vurgulanıyor — önceden hedefi görmeden tahminle bırakmak gerekiyordu. Ayrıca yeni "Ekrana Sığdır" butonu, aynı satırda duran çerçeveleri tek tıkla o satırı tam dolduracak şekilde eşit genişliğe getiriyor — elle sürükle-boyutlandırma sonucu oluşan boşluk/taşmayı otomatik düzeltiyor (sürekli bir ölçüm/gözlem yok, sadece tıklama anında bir kerelik ölçüm). Şema değişikliği yok.

## [2.12.27] - 2026-08-01

**AI konuşma ekranındaki yıldız simgeleri yanıp sönüyor:** Panel açıkken başlıktaki, karşılama ekranındaki ve her mesajın yanındaki parıltı simgeleri artık yumuşak bir şekilde yanıp sönerek (twinkle) canlı duruyor. Ana ekrandaki (kapalı panel) simge sakin/sabit kalmaya devam ediyor. Şema değişikliği yok.

## [2.12.26] - 2026-08-01

**AI simgesi/paneli sürüklerken daha doğal hareket ediyor:** Panel açıkken başlık çubuğundan tutup taşırken, konum geçişine uygulanan 300ms'lik animasyon (transition) fare imlecini gecikmeli "kovalıyormuş" gibi hissettiriyordu — artık sürükleme sırasında bu animasyon kapatılıp konum anlık takip ediyor, bırakınca yeniden yumuşak geçişe dönüyor. Hem simge hem panel, sürüklenirken hafifçe şeffaflaşarak (opacity düşerek) taşındığına dair görsel geri bildirim veriyor. Şema değişikliği yok.

## [2.12.25] - 2026-08-01

**Panel widget boyutlandırması gerçek kenar/köşe sürüklemeye geçirildi:** Önceki "boyut ikonuna tıkla, adım adım büyüsün" yöntemi kaldırıldı — "Paneli Düzenle" modunda artık her çerçevenin sağ-alt köşesinden tutup istenilen genişlik/yüksekliğe serbestçe sürüklenebiliyor (tarayıcının kendi native `resize` mekanizması). Sürükleme sırasında hiçbir sürekli JS ölçümü/ResizeObserver çalışmıyor — son boyut sadece bırakıldığında bir kerelik okunup kaydediliyor, bu yüzden react-grid-layout'ta yaşanan donma sınıfı hataya kapalı. Şema değişikliği yok.

## [2.12.24] - 2026-08-01

**Panel widget boyutlandırmasına daha küçük bir adım eklendi:** Boyut ikonuyla artık dörtte bir → üçte bir → yarım → üçte iki → tam genişlik arasında geçiş yapılabiliyor (önceden en küçük adım üçte birdi). Şema değişikliği yok.

## [2.12.23] - 2026-08-01

**Panel widget'ları güvenli bir yöntemle tekrar taşınabilir/boyutlandırılabilir yapıldı:** "Paneli Düzenle" modunda çerçeveler artık sürüklenip listede istenen konuma bırakılabiliyor (aynı satıra sığan widget'lar otomatik yan yana diziliyor) ve boyut ikonuyla üçte bir → yarım → üçte iki → tam genişlik arasında büyütülüp küçültülebiliyor. Bir önceki denemenin aksine (react-grid-layout, bkz. 2.12.22) bu sefer sürekli JS ölçümü/ResizeObserver KULLANILMIYOR — sabit birkaç genişlik adımı arasında geçiş yapan basit CSS class'ları ile çalışıyor, bu yüzden grafiklerle çakışıp donma riski yok. Şema değişikliği yok.

## [2.12.22] - 2026-08-01

**ACİL DÜZELTME: bir önceki sürüm (2.12.21) Panel'i tamamen açılmaz hale getiriyordu.** `react-grid-layout` kütüphanesinin otomatik genişlik ölçümü (ResizeObserver), grafiklerin kendi otomatik boyutlandırma mekanizmasıyla (Recharts `ResponsiveContainer`) çakışıp sonsuz bir ölçüm döngüsüne giriyordu — bu da CPU'yu %100'e kilitleyip uygulamanın "yükleniyor" ekranında donmasına, sonunda render sürecinin çökmesine yol açıyordu. Panel, 2.12.20'deki bilinen-çalışan sabit Tailwind grid yerleşimine geri alındı; `react-grid-layout` bağımlılığı kaldırıldı. Sürükle/yeniden-boyutlandırma özelliği kaldırıldı — daha güvenli bir yöntemle (grafik bileşenlerini otomatik ölçüm yapmayan bir moda alarak) yeniden ele alınacak.

## [2.12.21] - 2026-08-01

**Panel widget'ları artık gerçekten sürüklenip her yönden yeniden boyutlandırılabiliyor:** Önceki sabit satır/sütun (Tailwind grid) yerleşimi `react-grid-layout` tabanlı serbest bir grid'e geçirildi — "Paneli Düzenle" modunda her çerçeve tutup taşınabiliyor, kenarlarından (yukarı/aşağı/sağa/sola, köşelerden de) büyütülüp küçültülebiliyor. Konum/boyut kaydediliyor (mevcut widget göster/gizle mekanizmasıyla aynı `dashboard_layout` ayarında). Sürükleme sadece widget başlığındaki tutamaçtan başlıyor, böylece içerideki linkler/butonlar/inputlar (ör. döviz çevirici) düzenleme modunda da tıklanabilir kalıyor.

**Sol menüye sürüm/telif bilgisi eklendi:** Sidebar'ın en altına klinik adı, uygulamanın gerçek sürüm numarası (`package.json`'dan derleme zamanında okunuyor) ve "© {yıl} Elffarma Medikal Estetik — Tüm hakları saklıdır" satırı eklendi; menü listesi kendi içinde kayar, bu blok her zaman sayfanın en altında sabit kalır. Şema değişikliği yok.

## [2.12.20] - 2026-08-01

**Panel'e "Varsayılana Sıfırla" butonu eklendi:** "Paneli Düzenle" moduna girildiğinde artık tek tıkla tüm widget görünürlük/sıra tercihlerini kod varsayılanına (Stok Durumu kapalı, En Çok Satan Ürünler açık vb.) döndüren bir buton var — önceden kaydedilmiş widget tercihleri (ör. daha önce açılmış Stok Durumu) veritabanında saklandığı için koddaki varsayılan değişikliklerinden etkilenmiyordu, bu buton tek tıkla eski hâle dönmeyi sağlıyor. Şema değişikliği yok.

## [2.12.19] - 2026-08-01

**Hızlı İşlemler referans tasarıma göre güncellendi:** "Hızlı Erişim" bölümü "Hızlı İşlemler" olarak yeniden adlandırıldı ve içeriği kullanıcının paylaştığı referans tasarımdaki 8 işlemle eşleşecek şekilde değiştirildi: Fatura Oluştur, Tahsilat Ekle, Yeni Cari, Raporlar, Ajandaya Ekle, Hatırlatma Ekle, Prim Hesapla, Stok Durumu. Şema değişikliği yok.

Not: "Paneli Düzenle" ile daha önce açılmış olan Stok Durumu / Kongre Paket Fiyatları gibi ek widget'lar bu güncellemeyle otomatik kapanmaz (kişiye özel kayıtlı tercih) — referans tasarımdaki sade görünüm için Paneli Düzenle'den elle kapatılması gerekir.

**Panel'e ince/uzun döviz çevirici şeridi eklendi:** "Hoş geldiniz" başlığının hemen altına, tüm genişliği kaplayan ama az yer kaplayan (tek satır, pill şeklinde) bir döviz kuru + çevirici şeridi eklendi — USD/EUR güncel kur, tutar girişi, kaynak/hedef para birimi seçimi ve sonucu tek satırda gösteriyor. Alt bölümlerdeki "Döviz Kurları" widget'ı (daha büyük kart hali) aynen duruyor, admin isterse onu da ayrıca açabilir. Şema değişikliği yok.

## [2.12.17] - 2026-08-01

**Panel'de kartların üst üste binme hatası kalıcı olarak düzeltildi:** Bir bölümde (ör. "Ürünler / Kongreler / Temsilci Performansı" satırı) kullanıcı "Paneli Düzenle"den 3'ten fazla widget'ı görünür yaparsa (ör. 5 widget), hepsi tek bir dar grid'e sıkışıp kartların metinleri/gölgeleri birbirinin üzerine biniyordu. Artık her bölüm en fazla 3 sütunluk alt satırlara bölünüyor — kaç widget görünür olursa olsun (4, 5, 6...) asla taşma/binme olmuyor, fazlalar otomatik olarak bir alt satıra geçiyor. Ayrıca üstteki 4 özet kart Toplam Satış / Tahsilatlar / Toplam Cari (tüm doktorların açık bakiye toplamı) / Aktif Temsilci sayısı gösterecek şekilde güncellendi. Şema değişikliği yok.

## [2.12.16] - 2026-07-31

**Panel'deki boş/görünmez kart hatası kalıcı olarak düzeltildi:** Önceki üç sürümde denenen "tek ekrana sığdırma" yaklaşımı (sayfa kaydırması kapalı, satırlar `flex-1` ile kalan boşluğu paylaşıyordu) dar/kısa ekranlarda kartların neredeyse sıfır yüksekliğe sıkışıp içeriklerinin (grafik/liste) tamamen görünmez, boş gri şeritler halinde kalmasına yol açıyordu — kullanıcının ekran görüntüsünde bildirdiği tam olarak buydu. Panel artık uygulamanın diğer tüm sayfaları gibi normal şekilde kayan, her satırın kendi içeriğine göre doğal yüksekliğini aldığı bir sayfa; grafikler (Tahsilat Trendi, Stok Durumu, En Çok Satan Ürünler) da zorla küçültülmüş yükseklikleri yerine standart/okunaklı boyutlarına döndü. Widget'ları gösterme/gizleme ve kendi bölümü içinde sıralama özelliği aynen duruyor. Şema değişikliği yok.

## [2.12.15] - 2026-07-31

**Panel yerleşimi inline-hesaplanan grid'den sabit Tailwind grid class'larına geçirildi:** Bir önceki sürümdeki `grid-template-rows`/`gridTemplateColumns` inline stilleri bazı ekranlarda kartların üst üste binmesine yol açmaya devam ediyordu; artık satır/sütun yerleşimi tamamen bu projede zaten yaygın kullanılan sabit `grid-cols-*` class'larıyla yapılıyor (Aylık Satış grafiği + Hatırlatmalar satırı `grid-cols-3` üzerinden grafiğe 2/3 pay veriyor). Her hücrede `overflow-hidden` taşmayı kırpmaya devam ediyor.

## [2.12.14] - 2026-07-31

**Panel'de kartların üst üste binme hatası düzeltildi:** Bir önceki sürümdeki sabit yerleşimde, satırlara ayrılan yükseklik `flex-basis:0` ile hesaplandığından ve taşan içerik kırpılmadığından, kartlar bazen bir alttaki satırın üzerine görsel olarak biniyordu. Satır yükseklikleri artık doğrudan CSS Grid `grid-template-rows` ile ayrılıyor ve her hücreye taşmayı kırpan bir sınır eklendi — artık üst üste binme olmuyor. Grafik/liste boyutları da biraz daha güvenli bir dengeye çekildi.

## [2.12.13] - 2026-07-31

**Panel (Dashboard) sadeleştirildi, tek ekrana sığan sabit yerleşime geçti:** Panel artık kaydırma gerektirmiyor; Özet Kartları (Toplam Satış/Tahsilatlar/Toplam Cari/Aktif Temsilci), Aylık Satış Performansı grafiği, Yaklaşan Hatırlatmalar, En Çok Satan Ürünler, yeni **Yaklaşan Kongreler** kartı (şehir + Yaklaşıyor/Bugün rozeti — kongrelerde zaten var olan `city` alanını kullanıyor), Temsilci Performansı ve Hızlı İşlemler varsayılan olarak görünür. Diğer 10 widget (Kritik Uyarılar, Satış Trendi, Stok Durumu, Döviz Kurları, Satış Haritası, Kongre Fiyatları, Son İşlemler, Prim Özeti, Numune Dönüşümü, Lot/SKT Riski) **silinmedi** — varsayılan olarak gizli, "Paneli Düzenle"den admin istediği an geri açabilir/sıralayabilir. Sürükle-bırak yeniden sıralama artık widget'ın ait olduğu bölüm (satır) içinde çalışıyor. Sadece Panel sayfası için sayfa kaydırması kapatıldı (`AppShell.tsx`, diğer tüm sayfalar eskisi gibi kaydırmalı kalıyor); `RevenueChart`/`StockStatusChart`/`TopProductsChart` artık isteğe bağlı `height`/`rowHeight` parametresi alıyor (varsayılanlar korunduğu için Satışlar sayfası etkilenmedi). Şema değişikliği yok (`city` alanı zaten mevcuttu).

## [2.12.12] - 2026-07-31

**AI sohbet paneli kalite iyileştirmesi:** Soru gönderildikten sonra, ilk yanıt jetonu gelene kadar "yazıyor..." tarzı zıplayan üç nokta animasyonu gösteriliyor (öncesinde yanıt gelene kadar hiçbir geri bildirim yoktu). Mesajlar artık yumuşak bir giriş animasyonuyla beliriyor, kullanıcı mesajları dolu/kontrast bir balonla, asistan yanıtları daha okunaklı satır aralığıyla gösteriliyor; giriş kutusu odaklanınca hafif bir halka efekti alan, daha "pill" şekilli bir kutuya kavuştu; panel genel olarak daha yuvarlak köşeli ve gölgeli, daha premium bir görünüme kavuştu. Şema değişikliği yok.

## [2.12.11] - 2026-07-31

**AI simgesi görsel iyileştirme:** Önceki sürümdeki sert/gökkuşağı renk döngüsü animasyonu, uygulamanın kendi tema renklerinden (primary/gold/accent) oluşan yumuşak bir ışık kayması (shimmer) ile değiştirildi — simge artık hangi marka teması seçili olursa olsun panelle uyumlu görünüyor. Şema değişikliği yok.

## [2.12.10] - 2026-07-31

**AI simgesi görsel yenileme:** AI Asistan simgesi, dört uçlu, çok renkli, sürekli renk geçişi yapan parıldayan bir simgeye kavuştu (Google'ın gerçek Gemini logosu/asseti kullanılmadı — telif/marka nedeniyle sadece görsel dil benzer, kendi SVG'imiz ve gradyanımız). Panel başlığındaki ve sohbet mesajlarındaki küçük simgeler de aynı parıltı ikonuyla tutarlı hale getirildi. Şema değişikliği yok.

## [2.12.9] - 2026-07-31

**Hata düzeltmesi:** Gemini varsayılan modeli `gemini-2.5-flash` de Google tarafından yeni hesaplar için kullanımdan kaldırılmıştı (404: "no longer available to new users"). Sabit bir model sürümü yerine Google'ın her zaman güncel önerilen flash modeline işaret eden `gemini-flash-latest` takma adına geçildi — bir sonraki model kullanımdan kaldırılmasında bu sorun tekrar yaşanmayacak. Daha önce Ayarlar'dan model adı kaydedilmişse Model alanının elle `gemini-flash-latest` yapılması gerekiyor. Şema değişikliği yok.

## [2.12.8] - 2026-07-31

**Hata düzeltmesi:** AI sohbet paneli, simge ekranın kenarlarına yakın bir yere sürüklendiğinde (ör. üst veya sol kenar) açılınca ekranın dışına taşıp görünmez oluyordu — panelin konumu artık simgenin konumundan bağımsız hesaplanıyor ve pencerenin her zaman içinde kalacak şekilde otomatik olarak yukarı/aşağı yönde kendini ayarlıyor. Ayrıca Gemini sağlayıcısı, model adında yanlışlıkla `models/` öneki veya baştan/sondan boşluk bırakılırsa Google'ın "unexpected model name format" (400) hatası vermesini önlemek için model adını göndermeden önce temizliyor. Şema değişikliği yok.

## [2.12.7] - 2026-07-31

**AI simgesi taşınabilir/gizlenebilir + Gemini varsayılan model düzeltmesi:** Sağ alttaki AI Asistan simgesi artık sürüklenip ekranda istenen bir konuma bırakılabiliyor (konum cihaza özel hatırlanıyor) ve simgenin üzerine gelip küçük X'e basarak ana ekrandan tamamen gizlenebiliyor — geri getirmek için Ayarlar > Yapay Zeka'daki "Ana ekranda AI Asistan simgesini göster" anahtarı kullanılıyor. Ayrıca Gemini sağlayıcısının varsayılan modeli, Google tarafından kullanımdan kaldırılmış olan `gemini-1.5-flash`'tan güncel `gemini-2.5-flash`'a değiştirildi — daha önce Ayarlar'dan eski model adını kaydetmiş olanların Model alanını elle güncellemesi gerekiyor. Şema değişikliği yok.

## [2.12.6] - 2026-07-31

**AI sohbet paneli yenilendi + dosya/resim ekleme:** Sağ alttaki AI Asistan simgesi ve sohbet paneli Gemini tarzı, uygulamanın kendi tema renkleriyle uyumlu bir görünüme kavuştu (dönen/parlayan ikon, balonsuz asistan mesajları, pill şeklinde giriş kutusu). Sohbete artık ataç ikonundan resim ve Excel/CSV/txt dosyası eklenebiliyor: resimler bulut sağlayıcılarda (Gemini/OpenAI/Claude) gerçekten görsel olarak analiz ediliyor, Excel/CSV/txt dosyalarının içeriği metne çevrilip AI'a gönderiliyor. Yerel Ollama modeli resim analizi yapamadığından resim eklenip yerel model seçiliyken hata alınırsa kullanıcıya bulut sağlayıcıya geçme önerisi gösteriliyor. PDF/Word ekleri bu sürümde desteklenmiyor. Şema değişikliği yok.

## [2.12.5] - 2026-07-31

**Kişisel AI API anahtarı desteği:** Ayarlar > Yapay Zeka'da bulut sağlayıcı (OpenAI/Gemini/Claude) seçildiğinde artık her personel kendi API anahtarını "Kendi API Anahtarım" alanından girip kaydedebiliyor. Bu anahtar yeni `staff_ai_keys` tablosunda, sadece o personelin kendi hesabının okuyup yazabildiği bir satırda saklanıyor (diğer personel veya paylaşılan `app_settings` üzerinden görülemez) — paketlenmiş uygulamaya gömülen ortak bir anahtara gerek kalmadan her bilgisayarda, her personel kendi aboneliğiyle çalışabilir. Kişisel anahtar girilmezse (varsa) `.env`'deki ortak anahtara geri düşülür. Bu değişiklik şema değişikliği içerir — `supabase/schema.sql`'in TAMAMI yeniden SQL Editor'e yapıştırılıp çalıştırılmalı.

## [2.12.4] - 2026-07-31

**Yapay Zeka performans/kalite düzeltmesi:** Yerel Ollama modeli `qwen2.5:7b`'den daha hafif `qwen2.5:3b`'ye düşürüldü — düşük RAM'li bilgisayarlarda AI kullanılınca yaşanan donma/yavaşlama şikayeti, modelin makinenin belleğine göre çok ağır olmasından kaynaklanıyordu. Ayrıca AI sohbet ve analiz ekranlarındaki sistem mesajlarına "sadece Türkçe yaz" talimatı eklendi (yanıtlara bazen karışan Çince karakterleri önlemek için). Şema değişikliği yok. Not: daha önce Ayarlar > Yapay Zeka'dan model kaydedilmişse, kayıtlı ayar `.env`'deki yeni varsayılanı geçersiz kılar — model alanının elle `qwen2.5:3b` olarak güncellenmesi gerekir.

## [2.12.3] - 2026-07-31

**Çek ve Senet ödeme yöntemleri kaldırıldı** — işletme bu yöntemleri kullanmıyor. Nakit/Kredi Kartı/Havale/POS olarak 4 yönteme indirildi; Tahsilatlar sayfasındaki özet kartlar bu 4 yöntemle daha geniş/ferah bir ızgarada gösteriliyor. Veritabanı kısıtlamaları da eşleşecek şekilde daraltıldı. Bu değişiklik şema değişikliği içerir — `supabase/schema.sql`'in TAMAMI yeniden SQL Editor'e yapıştırılıp çalıştırılmalı.

## [2.12.2] - 2026-07-31

**Arayüz düzeltmesi:** Tahsilatlar sayfasındaki ödeme yöntemi özet kartları (Faz 7'de POS/Çek/Senet eklenince 3'ten 6'ya çıkmıştı) dar ekranlarda tek satıra sıkışıp büyük tutarların kesilmesine (taşmasına) neden oluyordu. Kart ızgarası artık ekran genişliğine göre 2/3/6 sütuna kademeli olarak yerleşiyor, tutar metni taşma yerine üç nokta ile kısaltılıp üzerine gelince tam değeri gösteriyor. Şema değişikliği yok.

## [2.12.1] - 2026-07-31

**Hata düzeltmesi:** `customers.preferred_payment_method` (doktor kartındaki "Tercih Edilen Ödeme Şekli") alanının veritabanı şeması, Faz 7'de `payments.payment_method`'a eklenen POS/Çek/Senet'i yansıtmıyordu — TypeScript tipi ve formdaki açılır liste tüm 6 yöntemi gösterdiği halde veritabanı CHECK kısıtlaması hâlâ sadece 3 yöntemi (Nakit/Kredi Kartı/Havale) kabul ediyordu. Doktor formunda POS/Çek/Senet seçilip kaydedilmeye çalışılınca kayıt başarısız oluyordu. Veritabanı kısıtlaması genişletildi, form tarafındaki tip daraltması düzeltildi. Bu düzeltme şema değişikliği içerir — `supabase/schema.sql`'in TAMAMI yeniden SQL Editor'e yapıştırılıp çalıştırılmalı.

## [2.12.0] - 2026-07-31

**Yapay Zeka özellikleri (Faz 10) — büyük ERP genişletmesinin son fazı:**
- Yeni **Yapay Zeka Analiz** sayfası, mevcut `AIService` üzerine kurulu, tüm modüllerden (stok/SKT, satış-tahsilat, prim, numune dönüşümü, tahsilat riski, CRM fırsatları, kongreler) canlı hesaplanmış tek bir veri özetini ("business snapshot") temel alıyor — AI kendi sayı uydurmuyor, gerçek verilerle konuşuyor:
  - **Doğal dil soru-cevap**: serbest metin soru sorup özet veriye dayalı yanıt alma.
  - **Otomatik yönetim raporu**: günlük/haftalık/aylık seçilebilir, Word'e aktarılabilir.
  - **Akıllı öneriler / anormallik tespiti**: öncelik sıralı aksiyon önerileri.
  - **Excel dosyası özetleme**: yüklenen Excel/CSV'nin AI ile özetlenmesi (PDF/Word okuma bu sürümde kapsam dışı — yeni ayrıştırma kütüphaneleri gerektirdiği için ileriye bırakıldı).
- AI sohbet widget'ına tarayıcı **SpeechRecognition** ile sesli metin girişi eklendi (mikrofon düğmesi) — tam "sesli komut yürütme" değil, konuşmayı yazıya çevirip sohbete ekleme.
- **Hata düzeltmesi**: Tahsilat formundaki (`PaymentForm`) doğrulama şeması POS/Çek/Senet'i kabul etmiyordu (Faz 7'de eklenen yöntemler) — açılır listede görünüp seçilince kayıt başarısız oluyordu, düzeltildi.
- Şema değişikliği yok.

Bu sürümle birlikte kullanıcının talep ettiği 13 modüllük büyük ERP genişletmesinin tüm fazları (Doktor/Klinik/Bölge/Temsilci, Prim, Numune, Kongre/Workshop, Lot/SKT, Ziyaret Planı, Tahsilat, CRM, Raporlama, Yapay Zeka) tamamlanmıştır.

## [2.11.0] - 2026-07-31

**Raporlama genişletmesi (Faz 9)** — büyük ERP genişletmesinin dokuzuncu fazı:
- Ana Panel'e 4 yeni sürüklenebilir/gizlenebilir widget eklendi: **Temsilci Performansı** (satış/tahsilat), **Prim Özeti** (bu ay, temsilci kırılımlı), **Numune Dönüşüm Oranı**, **Lot/SKT Riski** (90 gün içinde dolan lotlar + riskteki stok değeri).
- Bölge bazlı satış zaten mevcut "Satış Haritası" widget'ında karşılanıyordu — yeni tablo/kolon eklenmedi, bu faz sadece mevcut hesaplama motorlarını (prim, numune dönüşümü, lot SKT) panelde görünür kıldı.
- Şema değişikliği yok.

## [2.10.0] - 2026-07-30

**CRM modülü (Faz 8)** — büyük ERP genişletmesinin sekizinci fazı:
- Yeni **CRM** sayfası: fırsatlar satış hunisi aşamalarına göre (Yeni/Teklif/Müzakere/Kazanıldı/Kaybedildi) gruplanmış görünüyor, altında tüm doktorlara ait son aktiviteler akışı var.
- **Aktivite logu** (arama, WhatsApp, e-posta, toplantı, video görüşme, not) — takip tarihi girilirse otomatik olarak Hatırlatmalar'a ekleniyor.
- **Fırsat/teklif kayıtları** — tutar, beklenen kapanış tarihi, temsilci ile.
- Doktor detay sayfasındaki CRM sekmesi artık gerçek veriyle doluyor (o doktora ait fırsatlar + aktiviteler, hızlı ekleme butonlarıyla).
- Müşteri segmentleri ve dosyalar için mevcut etiket/Belgeler mekanizmaları yeniden kullanıldı — yeni tablo eklenmedi. Yapay zeka önerileri bu fazda değil, AI özellikleri fazında ele alınacak.
- Bu faz şema değişikliği içerir — `supabase/schema.sql`'in TAMAMI Supabase SQL Editor'e yeniden yapıştırılıp çalıştırılmalı.

## [2.9.0] - 2026-07-30

**Tahsilat Takibi genişletmesi (Faz 7)** — büyük ERP genişletmesinin yedinci fazı:
- Ödeme yöntemlerine **POS, Çek, Senet** eklendi (Nakit/Kredi Kartı/Havale-EFT yanına) — Kasa Özeti artık 6 yöntemi de ayrı ayrı gösteriyor.
- Yeni **taksitli tahsilat planı**: toplam tutar + taksit sayısı + aralık girilince taksitler otomatik oluşturuluyor; her taksit tek tıkla (yöntem seçilerek) tahsil edilip gerçek bir tahsilat kaydına dönüştürülüyor.
- **Risk Analizi** raporu: vadesi geçmiş taksitleri doktor bazında toplayıp geciken tutar, en uzun gecikme süresi ve plana tanımlı gecikme faizi oranından tahmini gecikme faizini gösteriyor.
- Makbuz/dekont ve otomatik cari işleme zaten mevcut mekanizmalarla (fatura dosyası eki, doktor bakiyesi hesaplaması) karşılanıyor — yeni bir şey eklenmedi.
- Bu faz şema değişikliği içerir — `supabase/schema.sql`'in TAMAMI Supabase SQL Editor'e yeniden yapıştırılıp çalıştırılmalı.

## [2.8.0] - 2026-07-30

**Doktor Ziyaret Planı genişletmesi (Faz 6)** — büyük ERP genişletmesinin altıncı fazı:
- Ziyaret kaydı artık isteğe bağlı olarak bir **cari karta bağlanabiliyor** — bağlandığında ziyaret ekranından doğrudan **Tahsilat Ekle** ve **Numune Ver** kısayolları açılıyor.
- **Check-in / Check-out**: ziyaret anında zaman damgası + tarayıcı Geolocation API'siyle tek seferlik konum kaydı (Google Maps linki) — masaüstü kapsamında canlı takip/rota optimizasyonu yerine bilinçli olarak bu sadeleştirilmiş haliyle uygulandı.
- Görüşülen ürünler, rakip ürünler, sonraki ziyaret tarihi alanları eklendi.
- Yeni **imza yakalama** (canvas tabanlı, harici kütüphane gerektirmez) — doktordan ziyaret sırasında imza alınabiliyor.
- Ziyaret kaydına foto/ses kaydı eklenebiliyor (genel Belgeler mekanizması, yeni `doctor_visit` owner_type).
- Bu faz şema değişikliği içerir — `supabase/schema.sql`'in TAMAMI Supabase SQL Editor'e yeniden yapıştırılıp çalıştırılmalı.

## [2.7.0] - 2026-07-30

**Lot ve SKT Takibi modülü (Faz 5)** — büyük ERP genişletmesinin beşinci fazı:
- Yeni `product_lots` tablosu: lot no, barkod/QR, üretim/SKT tarihi, depo, raf, tedarikçi, o lota özgü kalan miktar.
- Stok hareketi kaydı artık opsiyonel olarak bir lota bağlanabiliyor — `record_stock_movement` RPC'si hem genel ürün stoğunu hem de ilgili lotun miktarını tek atomik işlemde günceller.
- Hareket türlerine **İade** (stoğa geri dönüş) ve **İmha** (SKT/hasar nedeniyle düşüm) eklendi.
- Stok sayfasında yeni **Lotlar** görünümü (lot bazlı miktar + SKT durumu).
- **30/60/90 gün SKT alarmı**: lot bazlı son kullanma tarihleri artık bildirim zili ve Hatırlatmalar sayfasındaki Sistem Uyarıları listesinde de görünüyor (ürün seviyesindeki mevcut SKT uyarısına ek olarak).
- Bu faz şema değişikliği içerir — `supabase/schema.sql`'in TAMAMI Supabase SQL Editor'e yeniden yapıştırılıp çalıştırılmalı.

## [2.6.0] - 2026-07-30

**Kongre/Workshop modülü genişletmesi (Faz 4)** — büyük ERP genişletmesinin dördüncü fazı:
- Mimari not: workshop için ayrı bir tablo açılmadı — uygulama zaten "kongreler/workshoplar"ı tek modülde ele alıyordu (seed verisindeki "Workshoplar" kaydı buna örnek), bu yüzden workshop'a özgü alanlar mevcut `congresses`/`congress_participants` tablolarına eklendi.
- Kongre/workshop kartına: şehir, salon, otel, kontenjan, sponsorluk, konuşmacılar, eğitmenler, yemek planı, transfer, stand bilgisi, bütçe, kampanya, video linkleri.
- Katılımcı doktor kartına: **yoklama durumu** (Kayıtlı/Katıldı/Gelmedi), **katılım belgesi** işareti, otomatik oluşturulan **QR kayıt kodu**.
- Kongre/workshop detay sayfasına genel **Belgeler** paneli (sunum dosyası/broşür/fotoğraf yükleme — mevcut genel `attachments` mekanizması üzerinden).
- Bu faz şema değişikliği içerir — `supabase/schema.sql`'in TAMAMI Supabase SQL Editor'e yeniden yapıştırılıp çalıştırılmalı.

## [2.5.0] - 2026-07-30

**Numune Takibi modülü (Faz 3)** — büyük ERP genişletmesinin üçüncü fazı:
- Yeni **Numune Takibi** sayfası: doktora numune talebi oluşturma (lot no, SKT, adet, birim fiyat), onay/kargo/teslim durum akışı (Beklemede → Onaylandı/Reddedildi → Kargoya Verildi → Teslim Edildi), kargo takip no ve teslim alan bilgisi.
- Numune çıkışı artık stoktan da düşüyor — `record_stock_movement` RPC'sine yeni `sample` hareket türü eklendi (mevcut giriş/çıkış/düzeltme ile aynı atomik audit-trail mekanizması, stok modülünde ayrı bir "Numune" etiketiyle görünür).
- Doktor kartına opsiyonel **aylık/yıllık numune kotası** — kota aşılırsa talep oluşturulurken uyarı gösterilir (engellemez).
- **Numune → satış dönüşüm analizi**: bir numunenin verildiği tarihten sonra aynı doktora aynı ürünün satışı yapıldıysa "satışa döndü" sayılır — Numune Takibi sayfasında toplam/dönüşüm/yüzde özeti.
- Doktor detay sayfasındaki NUMUNELER sekmesi artık gerçek veriyle doluyor.
- Bu faz şema değişikliği içerir — `supabase/schema.sql`'in TAMAMI Supabase SQL Editor'e yeniden yapıştırılıp çalıştırılmalı.

## [2.4.0] - 2026-07-29

**Prim Hesaplama modülü (Faz 2)** — büyük ERP genişletmesinin ikinci fazı:
- Yeni **Prim Hesaplama** sayfası: ürün/kategori/marka/temsilci/klinik/doktor bazlı, satış veya tahsilat üzerinden dinamik prim kuralları tanımlanabiliyor.
- Prim tutarları ayrı bir tabloda saklanmıyor — seçilen tarih aralığı için mevcut satış/tahsilat verilerinden **canlı hesaplanıyor** (iade otomatik olarak prim tabanından düşülüyor).
- Manuel **bonus/ceza** girişleri (`commission_adjustments`) dönem bazında eklenip bordroya dahil ediliyor.
- Temsilci bazında prim kırılımı (hangi kural ne kadar prim üretti) + Excel/PDF/Word'e aktarılabilen bordro tablosu.
- Bu faz şema değişikliği içerir — `supabase/schema.sql`'in TAMAMI Supabase SQL Editor'e yeniden yapıştırılıp çalıştırılmalı (Faz 1'in şeması henüz uygulanmadıysa onunla birlikte tek seferde uygulanabilir).

## [2.3.3] - 2026-07-29

**Doktor/Klinik/Bölge/Temsilci genişletmesi (Faz 1)** — büyük ERP genişletmesinin ilk fazı:
- Yeni **Klinikler** modülü (`regions`, `clinics`, `attachments` tabloları): klinik kartı (yetkililer, vergi bilgileri, risk limiti, iskonto oranı, çalışma günleri, VIP durumu), sınırsız/iç içe bölge ağacı (il/ilçe), doktor↔klinik bağlantısı.
- Doktor (cari) kartına: otomatik doktor kodu (`DOC-000001`), uzmanlık, cep telefonu/WhatsApp/web sitesi/Instagram, ilçe, vergi dairesi, asistan/sekreter bilgileri, referans kişi, temsilci ve bölge bağlantısı, aktif/pasif durumu.
- Doktor detay sayfası artık **sekmeli** (Genel, İletişim, Finans, Satın Almalar, Ürünler, Numuneler, Workshop, Kongreler, Ziyaretler, Tahsilat, Belgeler, Mesajlar, CRM) — Numuneler/Workshop/CRM sekmeleri sonraki fazlarda dolacak.
- Genel amaçlı **Belgeler** (attachments) bileşeni — doktor ve klinik kartlarında dosya yükleme/indirme/silme.
- Bu faz şema değişikliği içerir — `supabase/schema.sql`'in TAMAMI Supabase SQL Editor'e yeniden yapıştırılıp çalıştırılmalı.

## [2.3.2] - 2026-07-29

AI widget'ında konuşma silme hatası düzeltildi: çöp kutusu ikonlu buton artık gerçekten `ai_conversations` kaydını (ve ilişkili mesajları) veritabanından siliyor — önceden sadece ekrandaki durumu sıfırlıyor, konuşma kalıcı olarak saklanmaya devam ediyordu. Ayrıca "yeni sohbet" başlatıldığında panelin otomatik olarak en son konuşmaya geri atlaması engellendi.

## [2.3.1] - 2026-07-29

AI sohbeti, Ayarlar sayfasına gömülü bir panel yerine **her sayfada görünen, animasyonlu, açılıp kapanabilen yüzen bir widget'a** (sağ alt köşe) taşındı. Ayarlar sayfasındaki test paneli kaldırıldı (tekrar önlendi) — Ayarlar artık sadece yapılandırma (sağlayıcı/model/URL/bağlantı testi) için.

## [2.3.0] - 2026-07-29

**Yapay Zekâ altyapısı** eklendi (`src/features/ai/` — diğer modüllerden bağımsız, kendi kendine yeten bir modül):
- **Provider mimarisi**: `AIProvider` TypeScript arayüzü + dört sağlayıcı (`OllamaProvider`, `OpenAIProvider`, `GeminiProvider`, `ClaudeProvider`). Ollama/OpenAI/Gemini, OpenAI-uyumlu `/chat/completions` + `/models` sözleşmesini konuşan ortak bir istemciyi (`openaiCompatible.ts`) paylaşıyor; Claude, Anthropic'in kendi Messages API'sini konuşuyor ama dışa aynı arayüzü sunuyor.
- **Tek giriş noktası**: `AIService` — tüm AI çağrıları buradan geçer, her çağrı otomatik olarak `ai_usage_logs`'a (süre, token, başarı/hata) kaydedilir.
- **Varsayılan**: Ollama + `qwen2.5:7b`, yerelde çalışır, API anahtarı gerekmez. Sağlayıcı/model/Base URL, Ayarlar > Yapay Zekâ'dan değiştirilebilir (paylaşılan `app_settings` tablosunda saklanır); bulut sağlayıcıların API anahtarları sadece `.env`'den okunur, hiçbir zaman veritabanına yazılmaz.
- **Streaming**: gerçek zamanlı token akışı; **konuşma geçmişi**: `ai_conversations`/`ai_messages` tabloları, uygulama içi test sohbet paneliyle (Ayarlar sayfası) uçtan uca doğrulandı.
- **Başlangıç kontrolü**: uygulama açılışında bir kez Ollama'ya bağlanmayı dener, bağlanamazsa veya model yüklü değilse bilgilendirici bir bildirim gösterir (engellemez).
- Bu sürüm sadece **altyapıyı** kurar (akıllı arama/rapor gibi somut AI özellikleri sonraki bir aşamada bu AIService üzerine inşa edilecek).

## [2.2.0] - 2026-07-29

**Günlük Stok Hareket Tablosu içe aktarma** eklendi (Stok sayfası, "Günlük Hareket Yükle (Excel)"). Kullanıcının halihazırda kullandığı Excel formatını (ürün adı × önceki stok × doktor/temsilci isimli sütunlar × kalan stok) birebir okuyacak şekilde tasarlandı:
- Her doktor sütunundaki pozitif sayı → o doktora **satış** (stok çıkış), negatif sayı → **iade** (stok giriş) olarak gerçek bir Satış kaydı + stok hareketi oluşturur.
- İsim bir doktora değil bir **satış temsilcisine** eşleşiyorsa (doktora bağlı olmayan elden teslim), düz bir stok hareketi olarak işlenir.
- Sütun başlıklarındaki tarih (birleştirilmiş hücreler dahil) otomatik okunur, her yüklemede doktor/temsilci isimleri ve tarihler değişebilir.
- Dosyadaki "Kalan Stoklar" değeri hesaplananla tutmuyorsa uyarı olarak raporlanır, işlemi durdurmaz.
- Ürün adı Stok'ta bulunamazsa veya isim ne doktor ne temsilci olarak eşleşmezse o satır/hücre atlanıp hata listesinde bildirilir.

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
