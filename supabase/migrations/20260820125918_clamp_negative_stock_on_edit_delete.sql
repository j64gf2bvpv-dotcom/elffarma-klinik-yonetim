-- Kullanıcı isteği: bir stok hareketini düzenlerken/silerken, sonuç
-- current_quantity/flakon_quantity'yi negatife düşürecekse önceki
-- davranış (check_violation yakalayıp reddetmek) iş akışını engelliyordu.
-- greatest(0,...) kırpma davranışına geri dönüldü — düzenleme/silme HER
-- ZAMAN başarılı olur, sonuç sadece 0'ın altına inmez (record_stock_movement
-- RPC'sindeki YENİ hareket oluşturma tarafındaki "yeterli stok yok" reddi
-- kasıtlı olarak DOKUNULMADAN kalıyor — satış/numune gibi ileriye dönük
-- işlemler için o kontrol hâlâ anlamlı).

create or replace function public.update_stock_movement(
  p_movement_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_reason text default null::text,
  p_customer_id uuid default null::uuid,
  p_note text default null::text,
  p_lot_id uuid default null::uuid,
  p_unit_price numeric default null::numeric,
  p_unit_kind text default 'paket'::text,
  p_sales_rep_id uuid default null::uuid
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
  if p_unit_kind not in ('paket', 'flakon') then
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

  update public.products
  set current_quantity = greatest(0, current_quantity
        - (case when v_old.unit_kind = 'paket' then v_old_delta else 0 end)
        + (case when p_unit_kind = 'paket' then v_new_delta else 0 end)),
      flakon_quantity = greatest(0, flakon_quantity
        - (case when v_old.unit_kind = 'flakon' then v_old_delta else 0 end)
        + (case when p_unit_kind = 'flakon' then v_new_delta else 0 end)),
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

create or replace function public.delete_stock_movement(p_movement_id uuid)
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

  if v_row.source_type is distinct from 'manual' and not public.is_admin() then
    raise exception '% kaynaklı bir hareket — sadece yönetici silebilir', v_row.source_type;
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
