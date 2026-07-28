-- Tahsilata hangi satış temsilcisinin sattığını ekler.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.payments
  add column if not exists sales_rep_id uuid references public.sales_reps (id);

comment on column public.payments.sales_rep_id is 'Bu tahsilatı/satışı yapan satış temsilcisi';
