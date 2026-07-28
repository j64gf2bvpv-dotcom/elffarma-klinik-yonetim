-- Kongreye götürülen ama doktora dağıtılmayan (kalan) ürünler
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

create table if not exists public.congress_remaining_products (
  id uuid primary key default gen_random_uuid(),
  congress_id uuid not null references public.congresses (id) on delete cascade,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists congress_remaining_products_congress_idx on public.congress_remaining_products (congress_id);

alter table public.congress_remaining_products enable row level security;

drop policy if exists "congress_remaining_products_all_staff" on public.congress_remaining_products;
create policy "congress_remaining_products_all_staff" on public.congress_remaining_products for all
  using (public.is_active_staff()) with check (public.is_active_staff());
