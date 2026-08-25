-- Kullanıcı isteğiyle (2026-08-25): "tüm stokları sıfırla kısmı bütün
-- kullanıcılara açık olsun" — önceden sadece is_admin() kontrolüyle
-- yöneticiye kilitliydi, uygulamanın geri kalanındaki paylaşılan-güven
-- modeliyle (herhangi bir aktif personel tüm satırları okuyup yazabilir)
-- tutarlı olsun diye is_active_staff() kontrolüne indirildi.
create or replace function public.reset_all_stock(p_reason text)
returns integer
language plpgsql
security definer set search_path = public
as $$
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
    select id, current_quantity, flakon_quantity from public.products
    where is_active = true and (current_quantity > 0 or flakon_quantity > 0)
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
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
