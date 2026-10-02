-- Ürün boyutu / içeriği (kullanıcı isteği, 2026-10-02: "ürünlerden sonra ml
-- sayıları gelsin, örnek 1 X 5 ML gibi ayrı bir sütun yap"). Serbest metin —
-- "6 X 6 ML", "200 MG X 1 FLAKON" gibi fiyat listesindeki yazımla tutulur.
-- enforce_products_staff_editable_columns tetikleyicisi bu alanı da kapsar:
-- sadece yönetici düzenler, personel görür.
alter table public.products
  add column if not exists package_size text;

comment on column public.products.package_size is 'Boyut / içerik (ör. 6 X 6 ML)';
