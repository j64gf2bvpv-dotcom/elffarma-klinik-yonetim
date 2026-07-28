-- TÜM BEKLEYEN GÜNCELLEMELER (tek seferde çalıştırın)
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp
-- çalıştırın. Kongreler, Günlük Sayım, Doktor Ziyaretleri, Faturalı/Faturasız,
-- Kampanya ve Ürün Görseli özelliklerinin hepsi için gereken tabloları/
-- sütunları tek seferde oluşturur.

-- Kongreler modülü — ek tablolar
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp
-- çalıştırın (daha önce schema.sql'i çalıştırdıysanız buna ek olarak).

create table if not exists public.congresses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  notes text,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Kongreye katılan doktor ve o doktora ait uçak/kayıt/konaklama maliyetleri
create table if not exists public.congress_participants (
  id uuid primary key default gen_random_uuid(),
  congress_id uuid not null references public.congresses (id) on delete cascade,
  doctor_name text not null,
  flight_cost numeric(10, 2) not null default 0,
  registration_cost numeric(10, 2) not null default 0,
  accommodation_cost numeric(10, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists congress_participants_congress_idx on public.congress_participants (congress_id);

-- Bir doktorun kongrede tek tek aldığı ürünler
create table if not exists public.congress_participant_products (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.congress_participants (id) on delete cascade,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists congress_products_participant_idx on public.congress_participant_products (participant_id);

drop trigger if exists set_updated_at on public.congresses;
create trigger set_updated_at before update on public.congresses
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.congress_participants;
create trigger set_updated_at before update on public.congress_participants
  for each row execute function public.set_updated_at();

alter table public.congresses enable row level security;
alter table public.congress_participants enable row level security;
alter table public.congress_participant_products enable row level security;

drop policy if exists "congresses_all_staff" on public.congresses;
create policy "congresses_all_staff" on public.congresses for all
  using (public.is_active_staff()) with check (public.is_active_staff());

drop policy if exists "congress_participants_all_staff" on public.congress_participants;
create policy "congress_participants_all_staff" on public.congress_participants for all
  using (public.is_active_staff()) with check (public.is_active_staff());

drop policy if exists "congress_products_all_staff" on public.congress_participant_products;
create policy "congress_products_all_staff" on public.congress_participant_products for all
  using (public.is_active_staff()) with check (public.is_active_staff());

insert into public.congresses (name)
select 'Workshoplar'
where not exists (select 1 from public.congresses where name = 'Workshoplar');

insert into public.congresses (name)
select 'Ekam Kongresi'
where not exists (select 1 from public.congresses where name = 'Ekam Kongresi');

insert into public.congresses (name)
select 'Medikal Estetik Kongresi'
where not exists (select 1 from public.congresses where name = 'Medikal Estetik Kongresi');

insert into public.congresses (name)
select 'Mısır Kongresi'
where not exists (select 1 from public.congresses where name = 'Mısır Kongresi');

-- Bitti. Kongreler bölümü artık uygulamada Kongreler menüsünden görünecektir.
-- Tarihleri boş bıraktım (gerçek tarihleri bilmediğim için) — uygulama
-- içinden düzenleyebilirsiniz.
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
-- Faturalı/Faturasız müşteri alanı
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.customers
  add column if not exists is_invoiced boolean not null default false;

comment on column public.customers.is_invoiced is 'Müşteri faturalı mı (true) yoksa faturasız mı (false) çalışılıyor';
-- Ürünlere kampanya bilgisi alanı (ör. "5+1", "10+2 / 20+5 / 30+8")
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.products
  add column if not exists campaign text;

comment on column public.products.campaign is 'Ürün kampanya bilgisi (ör. 5+1, 3+1)';
-- Kongreye katılım planı alanı
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.congresses
  add column if not exists will_attend boolean not null default false;

comment on column public.congresses.will_attend is 'Bu kongreye katılım planlanıyor mu (true) — uygulamada uyarı rozetiyle gösterilir';
-- Ürün küçük görsel URL alanı
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.products
  add column if not exists image_url text;

comment on column public.products.image_url is 'Ürün küçük görsel adresi (üretici sitesinden)';
