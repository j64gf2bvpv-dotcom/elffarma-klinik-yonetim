-- Yeni özellikler — ek tablolar (Günlük Stok Sayımı + Doktor Ziyaret Listesi)
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp
-- çalıştırın (daha önce schema.sql ve congresses.sql'i çalıştırdıysanız buna ek olarak).

-- =========================================================
-- GÜNLÜK STOK SAYIMI
-- =========================================================
create table if not exists public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  count_date date not null default current_date,
  status text not null default 'open' check (status in ('open', 'completed')),
  notes text,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.stock_count_items (
  id uuid primary key default gen_random_uuid(),
  stock_count_id uuid not null references public.stock_counts (id) on delete cascade,
  product_id uuid not null references public.products (id),
  expected_quantity integer not null,
  counted_quantity integer,
  note text,
  created_at timestamptz not null default now(),
  unique (stock_count_id, product_id)
);
create index if not exists stock_count_items_count_idx on public.stock_count_items (stock_count_id);

alter table public.stock_counts enable row level security;
alter table public.stock_count_items enable row level security;

drop policy if exists "stock_counts_all_staff" on public.stock_counts;
create policy "stock_counts_all_staff" on public.stock_counts for all
  using (public.is_active_staff()) with check (public.is_active_staff());

drop policy if exists "stock_count_items_all_staff" on public.stock_count_items;
create policy "stock_count_items_all_staff" on public.stock_count_items for all
  using (public.is_active_staff()) with check (public.is_active_staff());

-- =========================================================
-- DOKTOR ZİYARET LİSTESİ (satış temsilcileri, haftalık, gün gün)
-- =========================================================
create table if not exists public.doctor_visits (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null default current_date,
  doctor_name text not null,
  phone text,
  email text,
  social_media text,
  notes text,
  staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists doctor_visits_date_idx on public.doctor_visits (visit_date);

drop trigger if exists set_updated_at on public.doctor_visits;
create trigger set_updated_at before update on public.doctor_visits
  for each row execute function public.set_updated_at();

alter table public.doctor_visits enable row level security;

drop policy if exists "doctor_visits_all_staff" on public.doctor_visits;
create policy "doctor_visits_all_staff" on public.doctor_visits for all
  using (public.is_active_staff()) with check (public.is_active_staff());

-- Bitti. Uygulamada Stok > Günlük Sayım sekmesi ve yeni Doktor Ziyaretleri
-- sayfası artık kullanılabilir.
