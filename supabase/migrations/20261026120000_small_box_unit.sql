-- Küçük Kutu: Tam Paket (Kutu) ve Flakon'un yanında ayrı sayılan üçüncü stok
-- birimi (kullanıcı isteği, 2026-10-26: "küçük kutu sütunu da olmalı" — seçim:
-- "Flakon gibi ayrı sayılan stok"). Flakon'un birebir aynısı: ürün başına ayrı
-- önbellek (small_box_quantity), stok hareketlerinde unit_kind = 'kucuk_kutu',
-- günlük sayımda ayrı beklenen/sayılan alanlar. Hareket kaydet/düzenle/sil ve
-- tüm stoğu sıfırla RPC'leri yeni birimi tanıyor; paket ve flakon davranışı
-- değişmedi (fonksiyonlar veritabanındaki güncel tanımlarından türetildi).

alter table public.products
  add column if not exists small_box_quantity integer not null default 0;

alter table public.products drop constraint if exists products_small_box_quantity_check;
alter table public.products
  add constraint products_small_box_quantity_check check (small_box_quantity >= 0);

alter table public.stock_count_items
  add column if not exists expected_quantity_small_box integer not null default 0,
  add column if not exists counted_quantity_small_box integer;

alter table public.stock_movements drop constraint if exists stock_movements_unit_kind_check;
alter table public.stock_movements
  add constraint stock_movements_unit_kind_check check (unit_kind in ('paket', 'flakon', 'kucuk_kutu'));

CREATE OR REPLACE FUNCTION public.record_stock_movement(p_product_id uuid, p_movement_type text, p_quantity integer, p_reason text DEFAULT NULL::text, p_customer_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text, p_lot_id uuid DEFAULT NULL::uuid, p_unit_price numeric DEFAULT NULL::numeric, p_unit_kind text DEFAULT 'paket'::text, p_sales_rep_id uuid DEFAULT NULL::uuid, p_source_type text DEFAULT 'manual'::text, p_source_id uuid DEFAULT NULL::uuid, p_occurred_at timestamp with time zone DEFAULT now(), p_allow_expired_lot boolean DEFAULT false)
 RETURNS stock_movements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_delta integer;
  v_row public.stock_movements;
  v_lot public.product_lots;
  v_available integer;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Miktar sıfırdan büyük olmalı';
  end if;

  if p_movement_type not in ('in', 'out', 'adjustment', 'sample', 'return', 'disposal') then
    raise exception 'Geçersiz hareket türü: %', p_movement_type;
  end if;

  if p_unit_kind not in ('paket', 'flakon', 'kucuk_kutu') then
    raise exception 'Geçersiz birim türü: %', p_unit_kind;
  end if;

  if p_source_type not in ('manual', 'sale', 'sample', 'count', 'import', 'reset') then
    raise exception 'Geçersiz kaynak türü: %', p_source_type;
  end if;

  if p_lot_id is not null then
    if p_unit_kind <> 'paket' then
      raise exception 'Lot takibi sadece paket biriminde yapılabilir';
    end if;
    select * into v_lot from public.product_lots where id = p_lot_id;
    if not found then
      raise exception 'Lot bulunamadı';
    end if;
    if v_lot.product_id <> p_product_id then
      raise exception 'Seçilen lot bu ürüne ait değil';
    end if;
  end if;

  v_delta := public.stock_movement_delta(p_movement_type, p_quantity);

  if v_delta < 0 then
    if p_lot_id is not null then
      if v_lot.expiry_date is not null and v_lot.expiry_date < current_date
         and not (p_allow_expired_lot and public.is_admin()) then
        raise exception 'Bu lotun son kullanma tarihi geçmiş (%). Sevkiyat engellendi — yalnızca yönetici onayla devam edebilir.', to_char(v_lot.expiry_date, 'DD.MM.YYYY');
      end if;
      if v_lot.quantity + v_delta < 0 then
        raise exception 'Lotta yeterli stok yok: mevcut %, istenen %', v_lot.quantity, p_quantity;
      end if;
    elsif p_unit_kind = 'kucuk_kutu' then
      select small_box_quantity into v_available from public.products where id = p_product_id;
      if v_available is null then
        raise exception 'Ürün bulunamadı';
      end if;
      if v_available + v_delta < 0 then
        raise exception 'Yeterli küçük kutu stoğu yok: mevcut % küçük kutu, istenen % küçük kutu', v_available, p_quantity;
      end if;
    elsif p_unit_kind = 'flakon' then
      select flakon_quantity into v_available from public.products where id = p_product_id;
      if v_available is null then
        raise exception 'Ürün bulunamadı';
      end if;
      if v_available + v_delta < 0 then
        raise exception 'Yeterli flakon stoğu yok: mevcut % flakon, istenen % flakon', v_available, p_quantity;
      end if;
    else
      select current_quantity into v_available from public.products where id = p_product_id;
      if v_available is null then
        raise exception 'Ürün bulunamadı';
      end if;
      if v_available + v_delta < 0 then
        raise exception 'Yeterli paket stoğu yok: mevcut % paket, istenen % paket', v_available, p_quantity;
      end if;
    end if;
  end if;

  insert into public.stock_movements (
    product_id, movement_type, quantity, reason, customer_id, staff_id, note,
    lot_id, unit_price, unit_kind, sales_rep_id, source_type, source_id, occurred_at
  )
  values (
    p_product_id, p_movement_type, abs(p_quantity), p_reason, p_customer_id, auth.uid(), p_note,
    p_lot_id, p_unit_price, p_unit_kind, p_sales_rep_id, p_source_type, p_source_id, coalesce(p_occurred_at, now())
  )
  returning * into v_row;

  perform set_config('app.bypass_products_column_guard', 'true', true);

  if p_unit_kind = 'kucuk_kutu' then
    update public.products
    set small_box_quantity = small_box_quantity + v_delta,
        updated_at = now()
    where id = p_product_id;
  elsif p_unit_kind = 'flakon' then
    update public.products
    set flakon_quantity = flakon_quantity + v_delta,
        updated_at = now()
    where id = p_product_id;
  else
    update public.products
    set current_quantity = current_quantity + v_delta,
        updated_at = now()
    where id = p_product_id;

    if p_lot_id is not null then
      update public.product_lots
      set quantity = quantity + v_delta,
          updated_at = now()
      where id = p_lot_id;
    end if;
  end if;

  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_stock_movement(p_movement_id uuid, p_movement_type text, p_quantity integer, p_reason text DEFAULT NULL::text, p_customer_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text, p_lot_id uuid DEFAULT NULL::uuid, p_unit_price numeric DEFAULT NULL::numeric, p_unit_kind text DEFAULT 'paket'::text, p_sales_rep_id uuid DEFAULT NULL::uuid)
 RETURNS stock_movements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_old public.stock_movements;
  v_old_delta integer;
  v_new_delta integer;
  v_row public.stock_movements;
  v_lot public.product_lots;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  select * into v_old from public.stock_movements where id = p_movement_id;
  if not found then
    raise exception 'Hareket bulunamadı';
  end if;

  if v_old.source_type is distinct from 'manual' and not public.is_admin() then
    raise exception '% kaynaklı bir hareket — sadece yönetici düzenleyebilir', v_old.source_type;
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Miktar sıfırdan büyük olmalı';
  end if;
  if p_movement_type not in ('in', 'out', 'adjustment', 'sample', 'return', 'disposal') then
    raise exception 'Geçersiz hareket türü: %', p_movement_type;
  end if;
  if p_unit_kind not in ('paket', 'flakon', 'kucuk_kutu') then
    raise exception 'Geçersiz birim türü: %', p_unit_kind;
  end if;
  if p_lot_id is not null then
    if p_unit_kind <> 'paket' then
      raise exception 'Lot takibi sadece paket biriminde yapılabilir';
    end if;
    select * into v_lot from public.product_lots where id = p_lot_id;
    if not found or v_lot.product_id <> v_old.product_id then
      raise exception 'Seçilen lot bu ürüne ait değil';
    end if;
  end if;

  v_old_delta := public.stock_movement_delta(v_old.movement_type, v_old.quantity);
  v_new_delta := public.stock_movement_delta(p_movement_type, abs(p_quantity));

  perform set_config('app.bypass_products_column_guard', 'true', true);

  update public.products
  set current_quantity = greatest(0, current_quantity
        - (case when v_old.unit_kind = 'paket' then v_old_delta else 0 end)
        + (case when p_unit_kind = 'paket' then v_new_delta else 0 end)),
      flakon_quantity = greatest(0, flakon_quantity
        - (case when v_old.unit_kind = 'flakon' then v_old_delta else 0 end)
        + (case when p_unit_kind = 'flakon' then v_new_delta else 0 end)),
      small_box_quantity = greatest(0, small_box_quantity
        - (case when v_old.unit_kind = 'kucuk_kutu' then v_old_delta else 0 end)
        + (case when p_unit_kind = 'kucuk_kutu' then v_new_delta else 0 end)),
      updated_at = now()
  where id = v_old.product_id;

  if v_old.unit_kind = 'paket' and v_old.lot_id is not null and v_old.lot_id = p_lot_id then
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
      unit_kind = p_unit_kind,
      sales_rep_id = p_sales_rep_id
  where id = p_movement_id
  returning * into v_row;

  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_stock_movement(p_movement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if v_row.source_type is distinct from 'manual' and not public.is_admin() then
    raise exception '% kaynaklı bir hareket — sadece yönetici silebilir', v_row.source_type;
  end if;

  v_delta := public.stock_movement_delta(v_row.movement_type, v_row.quantity);

  perform set_config('app.bypass_products_column_guard', 'true', true);

  if v_row.unit_kind = 'kucuk_kutu' then
    update public.products
    set small_box_quantity = greatest(0, small_box_quantity - v_delta),
        updated_at = now()
    where id = v_row.product_id;
  elsif v_row.unit_kind = 'flakon' then
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

CREATE OR REPLACE FUNCTION public.reset_all_stock(p_reason text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_product record;
  v_count integer := 0;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Sıfırlama gerekçesi zorunludur';
  end if;

  for v_product in
    select id, current_quantity, flakon_quantity, small_box_quantity from public.products
    where is_active = true and (current_quantity > 0 or flakon_quantity > 0 or small_box_quantity > 0)
  loop
    if v_product.current_quantity > 0 then
      perform public.record_stock_movement(
        p_product_id := v_product.id,
        p_movement_type := 'out',
        p_quantity := v_product.current_quantity,
        p_reason := p_reason,
        p_unit_kind := 'paket',
        p_source_type := 'reset'
      );
    end if;
    if v_product.flakon_quantity > 0 then
      perform public.record_stock_movement(
        p_product_id := v_product.id,
        p_movement_type := 'out',
        p_quantity := v_product.flakon_quantity,
        p_reason := p_reason,
        p_unit_kind := 'flakon',
        p_source_type := 'reset'
      );
    end if;
    if v_product.small_box_quantity > 0 then
      perform public.record_stock_movement(
        p_product_id := v_product.id,
        p_movement_type := 'out',
        p_quantity := v_product.small_box_quantity,
        p_reason := p_reason,
        p_unit_kind := 'kucuk_kutu',
        p_source_type := 'reset'
      );
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;
