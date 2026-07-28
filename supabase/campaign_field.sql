-- Ürünlere kampanya bilgisi alanı (ör. "5+1", "10+2 / 20+5 / 30+8")
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.products
  add column if not exists campaign text;

comment on column public.products.campaign is 'Ürün kampanya bilgisi (ör. 5+1, 3+1)';
