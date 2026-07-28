-- Doktora opsiyonel "toplam borç/tutar" ekler (kalan tahsilatı hesaplamak için).
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.customers
  add column if not exists total_debt numeric(10, 2);

comment on column public.customers.total_debt is 'Opsiyonel: doktorla anlaşılan toplam tutar/borç — kalan tahsilat bundan hesaplanır';
