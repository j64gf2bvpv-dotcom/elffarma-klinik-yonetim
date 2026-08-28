-- "Ürünü kaldır" (deactivateProduct: is_active=false) doğrudan bir client-taraf
-- .update() çağrısıydı — products_staff_editable_columns_guard trigger'ı
-- is_active'i personelin (admin olmayan) değiştirebileceği alanlar arasında
-- saymadığından, personel için bu her zaman sessizce/hata ile reddediliyordu.
-- Kullanıcı isteği, 2026-08-28: "stok ürünlerde ürünleri düzenle ve sil bütün
-- kullanıcılarda olması gerekli". record_stock_movement ve benzerlerindeki
-- aynı desen: SECURITY DEFINER bir RPC, is_active_staff() yeterli (is_admin()
-- gerekmez), kendi products güncellemesinden hemen önce bypass bayrağını set
-- ediyor. Ürünün adı/kategorisi zaten personel tarafından değiştirilebiliyordu
-- (bkz. 20260821083430) — bu sadece "kaldır" (deaktive etme) eylemini de aynı
-- şekilde açıyor, fiyat/SKU/kritik stok gibi diğer alanlar hâlâ korunuyor.
create or replace function public.deactivate_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  perform set_config('app.bypass_products_column_guard', 'true', true);

  update public.products
  set is_active = false,
      updated_at = now()
  where id = p_product_id;
end;
$$;
