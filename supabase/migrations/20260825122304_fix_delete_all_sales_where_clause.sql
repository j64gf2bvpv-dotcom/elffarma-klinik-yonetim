-- delete_all_sales, "DELETE requires a WHERE clause" hatasıyla
-- başarısız oluyordu — Supabase'in veritabanı seviyesinde etkin olan
-- güvenlik uzantısı (pg-safeupdate), WHERE'siz bir DELETE'i (burada
-- `delete from public.sales;`) PL/pgSQL fonksiyonu içinden çağrılsa
-- bile reddediyor. Davranış aynı (tüm kayıtlar siliniyor), sadece
-- WHERE true eklendi.
create or replace function public.delete_all_sales(p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
  v_delta integer;
  v_count integer := 0;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Gerekçe zorunludur';
  end if;

  perform set_config('app.bypass_products_column_guard', 'true', true);

  for v_sale in select * from public.sales loop
    if v_sale.product_id is not null then
      v_delta := case when v_sale.type = 'sale' then v_sale.quantity else -v_sale.quantity end;

      insert into public.stock_movements (product_id, movement_type, quantity, reason, note, unit_kind, source_type)
      values (
        v_sale.product_id,
        case when v_sale.type = 'sale' then 'in' else 'out' end,
        v_sale.quantity,
        p_reason,
        v_sale.product_name,
        'paket',
        'reset'
      );

      update public.products
      set current_quantity = greatest(0, current_quantity + v_delta),
          updated_at = now()
      where id = v_sale.product_id;
    end if;
    v_count := v_count + 1;
  end loop;

  delete from public.sales where true;

  return v_count;
end;
$$;
