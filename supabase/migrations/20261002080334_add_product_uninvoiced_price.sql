-- Faturasız satış fiyatı (kullanıcı isteği, 2026-10-02: "stok kısmında satış
-- fiyatı yanına yeni sütunda faturasız fiyatı olmalı"). unit_price (faturalı
-- satış fiyatı) ile aynı tip; boş bırakılabilir. Mevcut
-- enforce_products_staff_editable_columns tetikleyicisi bu alanı da otomatik
-- kapsıyor — unit_price gibi sadece yönetici düzenleyebilir, personel görür.
alter table public.products
  add column if not exists unit_price_uninvoiced numeric(10, 2);

comment on column public.products.unit_price_uninvoiced is 'Faturasız satış fiyatı (TL)';
