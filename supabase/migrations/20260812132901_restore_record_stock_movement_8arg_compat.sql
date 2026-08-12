-- Bugün erken saatlerde eklenen add_flakon_stock migration'ı, aktif olarak
-- kullanılan 8 parametreli record_stock_movement/update_stock_movement
-- overload'larını DROP edip yerine (yeni p_unit_kind parametreli) 9
-- parametreli versiyonlarla değiştirmişti. Bu bir hataydı: henüz bu
-- değişikliği içeren bir derlemeye güncellenmemiş HER istemci (masaüstü
-- otomatik güncellemesi şu an ayrı bir imza sorunu yüzünden zaten çalışmıyor,
-- + mobil uygulama) hâlâ 8 anahtarla (p_unit_kind olmadan) çağrı yapıyor —
-- PostgREST artık bu anahtar kümesiyle eşleşen bir fonksiyon bulamıyor, RPC
-- çağrısı sessizce/hata ile başarısız oluyor, stok hiç düşmüyor/artmıyor
-- (kongre ürün dağıtımı dahil TÜM stok hareketleri etkilendi).
--
-- Düzeltme: eski 8 parametreli imzaları, 'paket' varsayılanıyla yeni 9
-- parametreli fonksiyona devreden ince birer "uyumluluk katmanı" olarak geri
-- ekliyoruz. Böylece hem eski hem yeni istemciler aynı anda çalışır — TÜM
-- kurulu uygulamalar (masaüstü + mobil) güncellenene kadar bu overload'lar
-- kalıcı olarak korunmalı, tekrar DROP edilmemeli.
create function public.record_stock_movement (
  p_product_id    uuid,
  p_movement_type text,
  p_quantity      integer,
  p_reason        text    default null::text,
  p_customer_id   uuid    default null::uuid,
  p_note          text    default null::text,
  p_lot_id        uuid    default null::uuid,
  p_unit_price    numeric default null::numeric
)
  returns public.stock_movements
  language sql
  security definer
  set search_path to 'public'
  as $function$
  select public.record_stock_movement(
    p_product_id, p_movement_type, p_quantity, p_reason,
    p_customer_id, p_note, p_lot_id, p_unit_price, 'paket'
  );
$function$;

grant all on function public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric) to anon;
grant all on function public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric) to authenticated;
grant all on function public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric) to service_role;

create function public.update_stock_movement (
  p_movement_id   uuid,
  p_movement_type text,
  p_quantity      integer,
  p_reason        text    default null::text,
  p_customer_id   uuid    default null::uuid,
  p_note          text    default null::text,
  p_lot_id        uuid    default null::uuid,
  p_unit_price    numeric default null::numeric
)
  returns public.stock_movements
  language sql
  security definer
  set search_path to 'public'
  as $function$
  select public.update_stock_movement(
    p_movement_id, p_movement_type, p_quantity, p_reason,
    p_customer_id, p_note, p_lot_id, p_unit_price, 'paket'
  );
$function$;

grant all on function public.update_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric) to anon;
grant all on function public.update_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric) to authenticated;
grant all on function public.update_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric) to service_role;
