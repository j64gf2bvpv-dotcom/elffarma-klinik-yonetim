-- Kongre modülünü Otel/Stand/Sponsorluk ile genişletir, kongre katılımcılarını/ürünlerini
-- gerçek doktor/ürün kayıtlarına bağlar (mevcut serbest metin alanları korunur), yeni
-- Workshop modülünü ekler ve giderlere kongre/workshop izlenebilirliği kazandırır.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

-- Oteller (basit isim bazlı liste — warehouses/sales_reps ile aynı desen)
create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.hotels enable row level security;

drop policy if exists "hotels_all_staff" on public.hotels;
create policy "hotels_all_staff" on public.hotels for all
  using (public.is_active_staff()) with check (public.is_active_staff());

-- Kongrelere otel/stand/sponsorluk maliyet alanları
alter table public.congresses add column if not exists hotel_id uuid references public.hotels (id);
alter table public.congresses add column if not exists hotel_cost numeric(10, 2);
alter table public.congresses add column if not exists stand_cost numeric(10, 2);
alter table public.congresses add column if not exists stand_notes text;
alter table public.congresses add column if not exists sponsor_name text;
alter table public.congresses add column if not exists sponsorship_amount numeric(10, 2);

comment on column public.congresses.hotel_cost is 'Konaklama maliyeti (otel firmasından bağımsız, bu kongreye özel tutar)';
comment on column public.congresses.stand_cost is 'Stand/fuar alanı maliyeti';
comment on column public.congresses.sponsorship_amount is 'Bu kongre için ödenen sponsorluk tutarı';

-- Kongre katılımcılarını gerçek doktor kaydına bağla — doctor_name serbest metni
-- geriye dönük uyumluluk için korunur, customer_id yeni katılımcılarda dolu olacak.
alter table public.congress_participants add column if not exists customer_id uuid references public.customers (id) on delete set null;

-- Kongride dağıtılan ürünleri gerçek ürün kaydına bağla — product_name serbest metni korunur.
alter table public.congress_participant_products add column if not exists product_id uuid references public.products (id);

-- Workshoplar — bir kongreye bağlı olabilir ya da bağımsız yapılabilir.
create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  congress_id uuid references public.congresses (id) on delete set null,
  name text not null,
  workshop_date date,
  location text,
  notes text,
  cost numeric(10, 2),
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workshops enable row level security;

drop policy if exists "workshops_all_staff" on public.workshops;
create policy "workshops_all_staff" on public.workshops for all
  using (public.is_active_staff()) with check (public.is_active_staff());

create index if not exists workshops_congress_idx on public.workshops (congress_id);

-- Workshopa katılan doktorlar — baştan gerçek customer_id FK ile (kongredeki eski
-- serbest-metin hatasını tekrarlamamak için).
create table if not exists public.workshop_participants (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.workshop_participants enable row level security;

drop policy if exists "workshop_participants_all_staff" on public.workshop_participants;
create policy "workshop_participants_all_staff" on public.workshop_participants for all
  using (public.is_active_staff()) with check (public.is_active_staff());

create index if not exists workshop_participants_workshop_idx on public.workshop_participants (workshop_id);
create index if not exists workshop_participants_customer_idx on public.workshop_participants (customer_id);

-- Workshopta kullanılan/dağıtılan ürünler — gerçek product_id FK ile; kaydedilince
-- istemci tarafında record_stock_movement RPC'si ve sales tablosuna satır eklenir
-- (bkz. src/features/workshops/api.ts), böylece stok düşer ve satış raporlarına yansır.
create table if not exists public.workshop_products (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  participant_id uuid references public.workshop_participants (id) on delete set null,
  product_id uuid not null references public.products (id),
  sales_rep_id uuid references public.sales_reps (id),
  quantity integer not null default 1,
  unit_price numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.workshop_products enable row level security;

drop policy if exists "workshop_products_all_staff" on public.workshop_products;
create policy "workshop_products_all_staff" on public.workshop_products for all
  using (public.is_active_staff()) with check (public.is_active_staff());

create index if not exists workshop_products_workshop_idx on public.workshop_products (workshop_id);

-- Giderlere kongre/workshop izlenebilirliği + yeni kategori değerleri
alter table public.expenses add column if not exists congress_id uuid references public.congresses (id) on delete set null;
alter table public.expenses add column if not exists workshop_id uuid references public.workshops (id) on delete set null;

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check
  check (category in ('hizmet_gideri', 'kongre_gideri', 'workshop_gideri', 'diger'));
