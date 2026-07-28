-- Ürünlere son kullanım tarihi, barkod ve marka (Dermakor/Swiss) ekler.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.products
  add column if not exists expiry_date date;

alter table public.products
  add column if not exists barcode text;

alter table public.products
  add column if not exists brand_line text;

alter table public.products
  drop constraint if exists products_brand_line_check;
alter table public.products
  add constraint products_brand_line_check check (brand_line is null or brand_line in ('dermakor', 'swiss'));

comment on column public.products.expiry_date is 'Opsiyonel: ürünün son kullanım tarihi';
comment on column public.products.barcode is 'Opsiyonel: ürün barkod numarası';
comment on column public.products.brand_line is 'Opsiyonel: dermakor veya swiss ürün hattı';
