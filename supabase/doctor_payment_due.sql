-- Doktorlara opsiyonel "ödeme vadesi" tarihi ekler (yaklaşan/gecikmiş ödemeleri işaretlemek için).
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.customers
  add column if not exists next_payment_due date;

comment on column public.customers.next_payment_due is 'Opsiyonel: doktorun bir sonraki ödeme vadesi tarihi';
