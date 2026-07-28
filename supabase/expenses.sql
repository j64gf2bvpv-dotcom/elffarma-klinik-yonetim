create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('hizmet_gideri', 'diger')),
  amount numeric(12, 2) not null check (amount > 0),
  description text,
  expense_date timestamptz not null default now(),
  staff_id uuid references public.staff (id),
  created_at timestamptz not null default now()
);

create index if not exists expenses_expense_date_idx on public.expenses (expense_date desc);
create index if not exists expenses_category_idx on public.expenses (category);

alter table public.expenses enable row level security;

drop policy if exists "expenses_all_staff" on public.expenses;
create policy "expenses_all_staff" on public.expenses for all
  using (public.is_active_staff()) with check (public.is_active_staff());
