-- Stok Kartı'nın "Tüm Ürünler" görünümünde de "Tüm Hareketleri Sil" butonu
-- olsun isteniyor (kullanıcı isteği, 2026-08-27) — mevcut
-- delete_all_stock_movements_for_product RPC'si tek bir ürüne kilitli, bu
-- görünümdeki ürün filtresi (ProductMultiCombobox — boş = tümü, doluysa
-- seçili ürünler) birden fazla/tüm ürünü kapsayabildiği için ayrı bir RPC
-- gerekiyor. p_product_ids NULL veya boş dizi ise TÜM ürünlerin geçmişini
-- siler; doluysa sadece o ürünlerinkini. Aynı şekilde sadece yöneticiye açık,
-- audit_logs'a tek bir kayıt (etkilenen ürün sayısı + silinen hareket sayısı)
-- olarak işleniyor.
create or replace function public.delete_all_stock_movements_bulk(
  p_product_ids uuid[],
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
  v_staff_name text;
  v_all boolean := p_product_ids is null or array_length(p_product_ids, 1) is null;
begin
  if not public.is_admin() then
    raise exception 'Sadece yönetici tüm ürünlerin hareketlerini silebilir';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Silme gerekçesi zorunludur';
  end if;

  if v_all then
    delete from public.stock_movements;
  else
    delete from public.stock_movements where product_id = any(p_product_ids);
  end if;
  get diagnostics v_count = row_count;

  if v_all then
    update public.products set current_quantity = 0, flakon_quantity = 0, updated_at = now();
  else
    update public.products
    set current_quantity = 0, flakon_quantity = 0, updated_at = now()
    where id = any(p_product_ids);
  end if;

  select full_name into v_staff_name from public.staff where id = auth.uid();

  insert into public.audit_logs (staff_id, staff_name, action, table_name, record_id, description, payload)
  values (
    auth.uid(),
    v_staff_name,
    'delete_all_stock_movements',
    'stock_movements',
    null,
    p_reason,
    jsonb_build_object(
      'product_ids', case when v_all then null else p_product_ids end,
      'scope', case when v_all then 'all' else 'selected' end,
      'deleted_count', v_count
    )
  );

  return v_count;
end;
$function$;

grant execute on function public.delete_all_stock_movements_bulk(uuid[], text) to authenticated;
