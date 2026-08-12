-- Kullanıcı kararını değiştirdi: paket ve flakon stoğu birbirini otomatik
-- ETKİLEMEMELİ — tamamen bağımsız iki sayaç olarak ayrı ayrı düşülmeli/
-- artmalı. Önceki tasarımda paket birimli bir hareket, ürünün flakon_per_
-- package oranı tanımlıysa flakon_quantity'i de orantılı olarak otomatik
-- güncelliyordu; bu davranış tamamen kaldırılıyor. Paket hareketleri artık
-- SADECE current_quantity'i, flakon hareketleri SADECE flakon_quantity'i
-- etkiliyor (ürünün flakon_per_package'ı olsun ya da olmasın fark etmez).
--
-- flakon_per_package alanı ve oranı ilk kez girildiğinde çalışan tek seferlik
-- başlangıç hesaplama tetikleyicisi (seed_flakon_quantity_on_ratio_set)
-- bundan ETKİLENMİYOR — o bir "hareket" değil, bir kerelik başlangıç
-- değeri ataması, bağımsız takip prensibiyle çelişmiyor.
create or replace function public.record_stock_movement (
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
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  v_delta := public.stock_movement_delta(p_movement_type, p_quantity);

  insert into public.stock_movements (product_id, movement_type, quantity, reason, customer_id, staff_id, note, lot_id, unit_price, unit_kind)
  values (p_product_id, p_movement_type, abs(p_quantity), p_reason, p_customer_id, auth.uid(), p_note, p_lot_id, p_unit_price, p_unit_kind)
  returning * into v_row;

  if p_unit_kind = 'flakon' then
    update public.products
    set flakon_quantity = greatest(0, flakon_quantity + v_delta),
        updated_at = now()
    where id = p_product_id;
  else
    update public.products
    set current_quantity = greatest(0, current_quantity + v_delta),
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

create or replace function public.update_stock_movement (
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

  update public.products
  set current_quantity = greatest(0, current_quantity
        - (case when v_old.unit_kind = 'paket' then v_old_delta else 0 end)
        + (case when p_unit_kind = 'paket' then v_new_delta else 0 end)),
      flakon_quantity = greatest(0, flakon_quantity
        - (case when v_old.unit_kind = 'flakon' then v_old_delta else 0 end)
        + (case when p_unit_kind = 'flakon' then v_new_delta else 0 end)),
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
    update public.products
    set current_quantity = greatest(0, current_quantity - v_delta),
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
