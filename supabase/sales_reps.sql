-- Satış temsilcileri (uygulama girişi olmadan isim bazlı liste)
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

create table if not exists public.sales_reps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.sales_reps enable row level security;

drop policy if exists "sales_reps_all_staff" on public.sales_reps;
create policy "sales_reps_all_staff" on public.sales_reps for all
  using (public.is_active_staff()) with check (public.is_active_staff());

alter table public.doctor_visits
  add column if not exists sales_rep_id uuid references public.sales_reps (id);

alter table public.doctor_visits
  drop column if exists staff_id;

comment on column public.doctor_visits.sales_rep_id is 'Personel girişi değil, serbest eklenen satış temsilcisi kaydı';
