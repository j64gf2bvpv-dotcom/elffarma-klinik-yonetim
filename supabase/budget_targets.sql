-- Bütçe Yılı modülü: her yıl/ay için ciro hedefi tutar, gerçekleşen tahsilatlarla karşılaştırılır.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

create table if not exists public.budget_targets (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  target_revenue numeric(12, 2) not null default 0,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);
create index if not exists budget_targets_year_idx on public.budget_targets (year);

alter table public.budget_targets enable row level security;

drop policy if exists "budget_targets_all_staff" on public.budget_targets;
create policy "budget_targets_all_staff" on public.budget_targets for all
  using (public.is_active_staff()) with check (public.is_active_staff());

comment on table public.budget_targets is 'Yıllık/aylık ciro bütçe hedefleri (Bütçe Yılı modülü)';
