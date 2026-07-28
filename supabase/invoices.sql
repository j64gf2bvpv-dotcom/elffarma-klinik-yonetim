-- Satışlar bölümündeki basit iç fatura kayıtları (e-Fatura entegrasyonu değildir).
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  customer_id uuid not null references public.customers (id) on delete cascade,
  amount numeric(10, 2) not null default 0,
  issue_date date not null default current_date,
  note text,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now()
);
create index if not exists invoices_customer_idx on public.invoices (customer_id);
create index if not exists invoices_issue_date_idx on public.invoices (issue_date);

alter table public.invoices enable row level security;

drop policy if exists "invoices_all_staff" on public.invoices;
create policy "invoices_all_staff" on public.invoices for all
  using (public.is_active_staff()) with check (public.is_active_staff());

comment on table public.invoices is 'Satışlar bölümünde tutulan basit iç fatura kayıtları';
