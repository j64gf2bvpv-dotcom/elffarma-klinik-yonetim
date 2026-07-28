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
