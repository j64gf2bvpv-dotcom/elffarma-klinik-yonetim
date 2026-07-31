# Değişiklik Günlüğü

Bu dosya, Elffarma Paket Programı'nda sürüm bazında yapılan değişiklikleri listeler.
Sürümleme [Semantic Versioning](https://semver.org/lang/tr/) mantığına göre yapılır (v1.0.0, v1.1.0, v2.0.0 ...).

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
