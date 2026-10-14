-- Satış fiyatını ve faturasız fiyatı TÜM aktif personel düzenleyebilsin
-- (kullanıcı isteği, 2026-10-14: "hem faturasız hem satış fiyatını tüm
-- kullanıcılar düzenleyebilsin"). RLS UPDATE politikası zaten
-- is_active_staff() — kısıt sadece bu tetikleyicide; personelin
-- değiştirebileceği sütunlara unit_price ve unit_price_uninvoiced ekleniyor.
-- Stok RPC'lerinin kullandığı app.bypass_products_column_guard istisnası
-- (bkz. 20260821085455) aynen korunuyor. Diğer tüm alanlar (stok miktarı,
-- kampanya, boyut, barkod…) yönetici-only kalmaya devam ediyor.

create or replace function public.enforce_products_staff_editable_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin()
     and coalesce(current_setting('app.bypass_products_column_guard', true), 'false') <> 'true' then
    if (to_jsonb(new) - 'name' - 'category' - 'unit_price' - 'unit_price_uninvoiced' - 'updated_at')
       is distinct from
       (to_jsonb(old) - 'name' - 'category' - 'unit_price' - 'unit_price_uninvoiced' - 'updated_at') then
      raise exception 'Bu alanı düzenleme yetkiniz yok — personel ürün adını, kategorisini, satış fiyatını ve faturasız fiyatı değiştirebilir.';
    end if;
  end if;
  return new;
end;
$$;
