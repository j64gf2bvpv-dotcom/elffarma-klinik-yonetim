-- Faturalı/Faturasız müşteri alanı
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.customers
  add column if not exists is_invoiced boolean not null default false;

comment on column public.customers.is_invoiced is 'Müşteri faturalı mı (true) yoksa faturasız mı (false) çalışılıyor';
