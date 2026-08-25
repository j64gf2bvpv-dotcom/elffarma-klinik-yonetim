-- Satış/iade kaydı silinirken stok etkisi TERSİNE çevriliyordu ama bu,
-- istemci tarafında guard'lı (yetersiz stokta reddeden) record_stock_movement
-- RPC'siyle yapılıyordu — orijinal satış/iade sonrasında stok başka
-- hareketlerle (ör. daha sonraki bir satış) tükenmişse, silme denemesi
-- "Yeterli paket stoğu yok" hatasıyla engelleniyordu (kullanıcı isteği,
-- 2026-08-25: "satışta iade olan kısmındaki ürünü silmiyor hata veriyor").
-- update_stock_movement/delete_stock_movement'taki aynı desenle (greatest(0,...))
-- tutarlı olsun diye burada da guard'sız, 0'a kenetlenen bir tersine çevirme
-- kullanılıyor — bir düzeltme/silme işlemi hiçbir zaman "yetersiz stok" diye
-- reddedilmemeli.
create or replace function public.delete_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
  v_delta integer;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  select * into v_sale from public.sales where id = p_sale_id;
  if not found then
    raise exception 'Kayıt bulunamadı';
  end if;

  if v_sale.product_id is not null then
    -- Orijinal kayıt satışsa stoktan düşmüştü (out), iade ise eklemişti (in) —
    -- silinince bunun TAM TERSİ uygulanır.
    v_delta := case when v_sale.type = 'sale' then v_sale.quantity else -v_sale.quantity end;

    insert into public.stock_movements (product_id, movement_type, quantity, reason, note, unit_kind, source_type)
    values (
      v_sale.product_id,
      case when v_sale.type = 'sale' then 'in' else 'out' end,
      v_sale.quantity,
      case when v_sale.type = 'sale' then 'Satış kaydı silindi — stok düzeltmesi' else 'İade kaydı silindi — stok düzeltmesi' end,
      v_sale.product_name,
      'paket',
      'manual'
    );

    perform set_config('app.bypass_products_column_guard', 'true', true);

    update public.products
    set current_quantity = greatest(0, current_quantity + v_delta),
        updated_at = now()
    where id = v_sale.product_id;
  end if;

  delete from public.sales where id = p_sale_id;
end;
$$;

grant execute on function public.delete_sale(uuid) to authenticated;

-- "Satışlar" bölümüne toplu "Tümünü Sil" (kullanıcı isteği, 2026-08-25) —
-- her kaydın stok etkisini yukarıdakiyle aynı guard'sız/kenetlenen mantıkla
-- tersine çevirip TÜM sales kayıtlarını siler.
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

  delete from public.sales;

  return v_count;
end;
$$;

grant execute on function public.delete_all_sales(text) to authenticated;
