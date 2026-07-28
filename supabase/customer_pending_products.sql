-- Doktora götürülüp henüz teslim edilmemiş / eksik kalan ürünleri doktorun kendi profilinde takip eder.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

create table if not exists public.customer_pending_products (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10, 2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists customer_pending_products_customer_idx on public.customer_pending_products (customer_id);

alter table public.customer_pending_products enable row level security;

drop policy if exists "customer_pending_products_all_staff" on public.customer_pending_products;
create policy "customer_pending_products_all_staff" on public.customer_pending_products for all
  using (public.is_active_staff()) with check (public.is_active_staff());

comment on table public.customer_pending_products is 'Doktora götürülen/satılan ama henüz eksik olan (teslim edilmemiş) ürünler';
