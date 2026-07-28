-- Stok modülünü ERP seviyesine çıkarma: depo, lot, seri, minimum stok.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

-- Depolar (basit isim bazlı liste — sales_reps ile aynı desen)
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.warehouses enable row level security;

drop policy if exists "warehouses_all_staff" on public.warehouses;
create policy "warehouses_all_staff" on public.warehouses for all
  using (public.is_active_staff()) with check (public.is_active_staff());

alter table public.products add column if not exists warehouse_id uuid references public.warehouses (id);
alter table public.products add column if not exists lot_number text;
alter table public.products add column if not exists serial_number text;
alter table public.products add column if not exists minimum_stock integer;

comment on column public.products.warehouse_id is 'Ürünün bulunduğu depo/lokasyon';
comment on column public.products.lot_number is 'Lot / parti numarası';
comment on column public.products.serial_number is 'Seri numarası (varsa)';
comment on column public.products.minimum_stock is 'Yeniden sipariş seviyesi — critical_stock_threshold''tan ayrı, erken uyarı amaçlı';
