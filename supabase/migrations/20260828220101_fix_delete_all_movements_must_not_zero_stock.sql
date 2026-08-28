-- OLAY (kullanıcı raporu, 2026-08-29): "Tüm Hareketleri Sil" (hem tek ürün
-- hem toplu/tüm-ürünler varyantı) sadece geçmiş hareket kayıtlarını (denetim
-- izini) silmesi beklenirken, arka planda etkilenen ürün(ler)in
-- current_quantity/flakon_quantity alanlarını da 0'a çekiyordu — bu, ürünün
-- GERÇEK fiziksel stoğuyla hiçbir ilgisi olmayan, sadece "boş bir hareket
-- defteriyle tutarlı olsun" gerekçesiyle eklenmiş (2026-08-20) bir tasarım
-- hatasıydı. 2026-08-27 23:55'te (yerel saat) "tüm ürünler" kapsamında
-- kullanılınca KATALOGDAKİ NEREDEYSE HER ÜRÜNÜN gerçek stok miktarı sıfıra
-- düştü — üstelik aynı çağrı stock_movements'ı da sildiği için bu kaybın
-- hiçbir denetim izi kalmadı, geri alınamadı.
--
-- DÜZELTME: her iki RPC de artık SADECE stock_movements satırlarını siliyor.
-- products.current_quantity/flakon_quantity HİÇBİR ŞEKİLDE dokunulmuyor —
-- CLAUDE.md kuralı gereği bu alan zaten sadece record_stock_movement RPC'si
-- üzerinden değişmeli, "geçmişi temizleme" bambaşka bir işlemdir ve gerçek
-- güncel stoğu etkilememelidir.
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
    delete from public.stock_movements where true;
  else
    delete from public.stock_movements where product_id = any(p_product_ids);
  end if;
  get diagnostics v_count = row_count;

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
