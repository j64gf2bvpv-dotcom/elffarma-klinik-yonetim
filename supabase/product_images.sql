-- Ürün küçük görsel URL alanı
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.products
  add column if not exists image_url text;

comment on column public.products.image_url is 'Ürün küçük görsel adresi (üretici sitesinden)';
