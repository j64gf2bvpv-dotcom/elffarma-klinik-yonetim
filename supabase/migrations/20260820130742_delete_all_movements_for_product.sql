-- Kullanıcı isteği: Stok Kartı'nın tek-ürün görünümünde, o ürünün TÜM
-- geçmiş stok hareketlerini kalıcı olarak silen bir "Tüm Hareketleri Sil"
-- butonu (yalnızca o an görüntülenen ürün — "Tüm Ürünler" görünümündeki
-- diğer ürünlere dokunmaz). stock_movements normalde asıl kaynak/denetim
-- kaydı olarak hiç silinmez (bkz. CLAUDE.md) — bu yüzden bilerek sadece
-- yöneticiye açık ve bir gerekçe zorunlu; gerekçe + kim yaptığı + kaç kayıt
-- silindiği audit_logs'a yazılıyor ki hareketlerin kendisi gitse de bu
-- işlemin izi kalsın. Silme sonrası ürünün current_quantity/flakon_quantity
-- 0'a çekiliyor — boş bir defterle tutarlı tek değer bu.
create or replace function public.delete_all_stock_movements_for_product(
  p_product_id uuid,
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
begin
  if not public.is_admin() then
    raise exception 'Sadece yönetici bir ürünün tüm hareketlerini silebilir';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Silme gerekçesi zorunludur';
  end if;

  delete from public.stock_movements where product_id = p_product_id;
  get diagnostics v_count = row_count;

  update public.products
  set current_quantity = 0,
      flakon_quantity = 0,
      updated_at = now()
  where id = p_product_id;

  select full_name into v_staff_name from public.staff where id = auth.uid();

  insert into public.audit_logs (staff_id, staff_name, action, table_name, record_id, description, payload)
  values (
    auth.uid(),
    v_staff_name,
    'delete_all_stock_movements',
    'stock_movements',
    p_product_id::text,
    p_reason,
    jsonb_build_object('product_id', p_product_id, 'deleted_count', v_count)
  );

  return v_count;
end;
$function$;

grant execute on function public.delete_all_stock_movements_for_product(uuid, text) to authenticated;
