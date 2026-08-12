-- Ürünlerde paket/flakon bağlı stok takibi.
--
-- current_quantity'nin anlamı DEĞİŞMİYOR (hâlâ paket/kutu adedi) — hiçbir
-- ürünün geçmiş verisi yeniden yorumlanmıyor. Yeni bağımsız ikinci bir stok
-- önbelleği (flakon_quantity) ve ürün başına opsiyonel bir oran
-- (flakon_per_package) ekleniyor. Paket birimli hareketler (varsayılan —
-- kongre dağıtımı, günlük sayım, mobil dahil TÜM mevcut çağıranların
-- davranışı) current_quantity'i eskisi gibi değiştirir; ürünün oranı
-- tanımlıysa flakon_quantity'i de orantılı olarak otomatik günceller. Flakon
-- birimli hareketler (yeni, sadece "Stok Hareketi Ekle" ekranında bir
-- seçenek) sadece flakon_quantity'i değiştirir, paket ve parti (lot) hiç
-- etkilenmez.

alter table public.products
  add column flakon_per_package integer,
  add column flakon_quantity integer not null default 0;

alter table public.products
  add constraint products_flakon_per_package_check check (flakon_per_package is null or flakon_per_package > 0);

alter table public.stock_movements
  add column unit_kind text not null default 'paket';

alter table public.stock_movements
  add constraint stock_movements_unit_kind_check check (unit_kind in ('paket', 'flakon'));

-- record_stock_movement: parametre listesi değiştiği için önce eski imzalar
-- (kullanılan 8'li + zaten kullanılmayan, biri hatalı 7'li ve 6'lı overload'lar)
-- DROP edilip tek, güncel 9'lu imzayla yeniden CREATE ediliyor — aksi halde
-- CREATE OR REPLACE farklı parametre listesiyle yeni bir overload olarak kalır.
drop function if exists public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric);
drop function if exists public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid);
drop function if exists public.record_stock_movement(uuid, text, integer, text, uuid, text);

create function public.record_stock_movement (
  p_product_id    uuid,
  p_movement_type text,
  p_quantity      integer,
  p_reason        text    default null::text,
  p_customer_id   uuid    default null::uuid,
  p_note          text    default null::text,
  p_lot_id        uuid    default null::uuid,
  p_unit_price    numeric default null::numeric,
  p_unit_kind     text    default 'paket'::text
)
  returns public.stock_movements
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  v_delta integer;
  v_row public.stock_movements;
  v_flakon_per_package integer;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  v_delta := public.stock_movement_delta(p_movement_type, p_quantity);

  insert into public.stock_movements (product_id, movement_type, quantity, reason, customer_id, staff_id, note, lot_id, unit_price, unit_kind)
  values (p_product_id, p_movement_type, abs(p_quantity), p_reason, p_customer_id, auth.uid(), p_note, p_lot_id, p_unit_price, p_unit_kind)
  returning * into v_row;

  if p_unit_kind = 'flakon' then
    -- Flakon birimli hareket: sadece flakon sayısı değişir, paket ve parti hiç etkilenmez.
    update public.products
    set flakon_quantity = greatest(0, flakon_quantity + v_delta),
        updated_at = now()
    where id = p_product_id;
  else
    select flakon_per_package into v_flakon_per_package from public.products where id = p_product_id;

    update public.products
    set current_quantity = greatest(0, current_quantity + v_delta),
        flakon_quantity = case
          when v_flakon_per_package is not null then greatest(0, flakon_quantity + v_delta * v_flakon_per_package)
          else flakon_quantity
        end,
        updated_at = now()
    where id = p_product_id;

    if p_lot_id is not null then
      update public.product_lots
      set quantity = greatest(0, quantity + v_delta),
          updated_at = now()
      where id = p_lot_id;
    end if;
  end if;

  return v_row;
end;
$function$;

grant all on function public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric, text) to anon;
grant all on function public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric, text) to authenticated;
grant all on function public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric, text) to service_role;

-- update_stock_movement: aynı sebeple DROP + CREATE. Eski/yeni taraf paket ya
-- da flakon birimli olabileceğinden current_quantity ve flakon_quantity için
-- eski etkiyi geri alıp yeni etkiyi uygulama TEK bir UPDATE'te (ayrı ayrı
-- değil) yapılıyor — orijinal koddaki "ara clamp gerçek farkı kaybettirir"
-- uyarısı burada da geçerli. Parti (lot) miktarı her zaman paket bazlı;
-- flakon birimli taraf lot'u hiç etkilemez.
drop function if exists public.update_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric);

create function public.update_stock_movement (
  p_movement_id   uuid,
  p_movement_type text,
  p_quantity      integer,
  p_reason        text    default null::text,
  p_customer_id   uuid    default null::uuid,
  p_note          text    default null::text,
  p_lot_id        uuid    default null::uuid,
  p_unit_price    numeric default null::numeric,
  p_unit_kind     text    default 'paket'::text
)
  returns public.stock_movements
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  v_old public.stock_movements;
  v_old_delta integer;
  v_new_delta integer;
  v_row public.stock_movements;
  v_flakon_per_package integer;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  select * into v_old from public.stock_movements where id = p_movement_id;
  if not found then
    raise exception 'Hareket bulunamadı';
  end if;

  v_old_delta := public.stock_movement_delta(v_old.movement_type, v_old.quantity);
  v_new_delta := public.stock_movement_delta(p_movement_type, abs(p_quantity));

  select flakon_per_package into v_flakon_per_package from public.products where id = v_old.product_id;

  update public.products
  set current_quantity = greatest(0, current_quantity
        - (case when v_old.unit_kind = 'paket' then v_old_delta else 0 end)
        + (case when p_unit_kind = 'paket' then v_new_delta else 0 end)),
      flakon_quantity = greatest(0, flakon_quantity
        - (case
             when v_old.unit_kind = 'flakon' then v_old_delta
             when v_flakon_per_package is not null then v_old_delta * v_flakon_per_package
             else 0
           end)
        + (case
             when p_unit_kind = 'flakon' then v_new_delta
             when v_flakon_per_package is not null then v_new_delta * v_flakon_per_package
             else 0
           end)),
      updated_at = now()
  where id = v_old.product_id;

  if v_old.unit_kind = 'paket' and p_unit_kind = 'paket' and v_old.lot_id is not null and v_old.lot_id = p_lot_id then
    update public.product_lots
    set quantity = greatest(0, quantity - v_old_delta + v_new_delta),
        updated_at = now()
    where id = p_lot_id;
  else
    if v_old.unit_kind = 'paket' and v_old.lot_id is not null then
      update public.product_lots
      set quantity = greatest(0, quantity - v_old_delta),
          updated_at = now()
      where id = v_old.lot_id;
    end if;
    if p_unit_kind = 'paket' and p_lot_id is not null then
      update public.product_lots
      set quantity = greatest(0, quantity + v_new_delta),
          updated_at = now()
      where id = p_lot_id;
    end if;
  end if;

  update public.stock_movements
  set movement_type = p_movement_type,
      quantity = abs(p_quantity),
      reason = p_reason,
      customer_id = p_customer_id,
      note = p_note,
      lot_id = p_lot_id,
      unit_price = p_unit_price,
      unit_kind = p_unit_kind
  where id = p_movement_id
  returning * into v_row;

  return v_row;
end;
$function$;

grant all on function public.update_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric, text) to anon;
grant all on function public.update_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric, text) to authenticated;
grant all on function public.update_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric, text) to service_role;

-- delete_stock_movement: imza değişmiyor (hâlâ tek uuid parametresi), bu
-- yüzden CREATE OR REPLACE yeterli — sadece gövde, kaydın kendi unit_kind'ına
-- göre doğru sayacı (paket + orantılı flakon, ya da sadece flakon) geri alacak
-- şekilde güncelleniyor.
create or replace function public.delete_stock_movement (
  p_movement_id uuid
)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  v_row public.stock_movements;
  v_delta integer;
  v_flakon_per_package integer;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  select * into v_row from public.stock_movements where id = p_movement_id;
  if not found then
    raise exception 'Hareket bulunamadı';
  end if;

  v_delta := public.stock_movement_delta(v_row.movement_type, v_row.quantity);

  if v_row.unit_kind = 'flakon' then
    update public.products
    set flakon_quantity = greatest(0, flakon_quantity - v_delta),
        updated_at = now()
    where id = v_row.product_id;
  else
    select flakon_per_package into v_flakon_per_package from public.products where id = v_row.product_id;

    update public.products
    set current_quantity = greatest(0, current_quantity - v_delta),
        flakon_quantity = case
          when v_flakon_per_package is not null then greatest(0, flakon_quantity - v_delta * v_flakon_per_package)
          else flakon_quantity
        end,
        updated_at = now()
    where id = v_row.product_id;

    if v_row.lot_id is not null then
      update public.product_lots
      set quantity = greatest(0, quantity - v_delta),
          updated_at = now()
      where id = v_row.lot_id;
    end if;
  end if;

  delete from public.stock_movements where id = p_movement_id;
end;
$function$;
