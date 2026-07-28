-- Kongre dışı genel ürün satışları (Satışlar modülü).
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'sale' check (type in ('sale', 'return')),
  customer_id uuid not null references public.customers (id) on delete cascade,
  sales_rep_id uuid references public.sales_reps (id),
  product_id uuid references public.products (id),
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10, 2) not null default 0,
  sale_date date not null default current_date,
  note text,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now()
);
create index if not exists sales_customer_idx on public.sales (customer_id);
create index if not exists sales_sale_date_idx on public.sales (sale_date);

alter table public.sales enable row level security;

drop policy if exists "sales_all_staff" on public.sales;
create policy "sales_all_staff" on public.sales for all
  using (public.is_active_staff()) with check (public.is_active_staff());

comment on table public.sales is 'Kongre dışı genel ürün satışları ve iadeleri (doktor + satış temsilcisi bilgisiyle, stok hareketine yansır)';
