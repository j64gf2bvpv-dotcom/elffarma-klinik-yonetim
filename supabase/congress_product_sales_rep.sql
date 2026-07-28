-- Kongrede bir doktora satılan ürüne hangi satış temsilcisinin sattığını ekler.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.congress_participant_products
  add column if not exists sales_rep_id uuid references public.sales_reps (id);

comment on column public.congress_participant_products.sales_rep_id is 'Bu ürünü doktora satan satış temsilcisi';
