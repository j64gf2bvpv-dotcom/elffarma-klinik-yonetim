-- Bir ürüne "paket içinde kaç flakon var" oranı İLK KEZ girildiğinde
-- (flakon_per_package null'dan bir değere geçince), flakon_quantity hâlâ 0
-- ise mevcut paket adedine göre otomatik hesaplanır (current_quantity *
-- flakon_per_package). Kullanıcı geri bildirimi: oranı girip kaydettiğinde
-- Stok sayfasındaki Flakon sütununda hiçbir sayı görünmemesi ("rakam
-- yansımıyor") kafa karıştırıcıydı — flakon_quantity'nin bilerek geriye
-- dönük hesaplanmadığı (add_flakon_stock migration'ındaki tasarım notu)
-- teknik olarak doğruydu ama kullanıcı beklentisiyle uyuşmuyordu.
--
-- `flakon_quantity = 0` koruması: oran daha önce zaten set edilmişken tekrar
-- değiştirilirse (veya flakon_quantity zaten gerçek hareketlerle birikmişse)
-- bu tetikleyici üzerine yazmaz — sadece gerçekten "ilk kez açılış" anında
-- çalışır. Bu bir stok hareketi değil (fiziksel bir şey hareket etmiyor,
-- sadece mevcut stoğun yeni bir birimde ifadesi), bu yüzden stock_movements
-- denetim kaydı oluşturmuyor — ürünün diğer alanlarını (isim, fiyat vb.)
-- düzenlemekle aynı kategoride.
create or replace function public.seed_flakon_quantity_on_ratio_set()
returns trigger
language plpgsql
as $function$
begin
  if new.flakon_per_package is not null
     and old.flakon_per_package is null
     and new.flakon_quantity = 0 then
    new.flakon_quantity := new.current_quantity * new.flakon_per_package;
  end if;
  return new;
end;
$function$;

create trigger seed_flakon_quantity_on_ratio_set
  before update on public.products
  for each row
  execute function public.seed_flakon_quantity_on_ratio_set();
