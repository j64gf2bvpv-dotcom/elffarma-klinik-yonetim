-- Klinik Yönetim — Supabase şema betiği
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp
-- tek seferde çalıştırın. Tüm tabloları, güvenlik kurallarını (RLS),
-- yardımcı fonksiyonları ve örnek WhatsApp şablonlarını oluşturur.

create extension if not exists pgcrypto;

-- =========================================================
-- 1. STAFF (personel) — auth.users ile 1:1 profil tablosu
-- =========================================================
create table if not exists public.staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('admin', 'staff')),
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Yeni bir kullanıcı (auth.users) oluşturulduğunda otomatik olarak bir
-- staff profili oluşturur. İlk kullanıcı otomatik admin olur, sonrakiler
-- personel (staff) olarak eklenir; admin daha sonra Ayarlar ekranından
-- rolleri değiştirebilir.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  first_user boolean;
begin
  select not exists (select 1 from public.staff) into first_user;
  insert into public.staff (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when first_user then 'admin' else 'staff' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Yardımcı fonksiyon: giriş yapan kullanıcı admin mi?
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.staff
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

-- Yardımcı fonksiyon: giriş yapan kullanıcı aktif bir personel mi?
create or replace function public.is_active_staff()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.staff
    where id = auth.uid() and is_active = true
  );
$$;

-- =========================================================
-- 2. CUSTOMERS (müşteriler)
-- =========================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  birth_date date,
  notes text,
  tags text[] not null default '{}',
  is_invoiced boolean not null default false,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_full_name_idx on public.customers using gin (to_tsvector('simple', full_name));
create index if not exists customers_phone_idx on public.customers (phone);

-- =========================================================
-- 3. PRODUCTS (ürünler / stok kartı)
-- =========================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  category text,
  unit text not null default 'adet',
  critical_stock_threshold integer not null default 5,
  current_quantity integer not null default 0,
  unit_cost numeric(10, 2),
  unit_price numeric(10, 2),
  campaign text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 4. STOCK_MOVEMENTS (stok hareket defteri — asıl kaynak)
-- =========================================================
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment')),
  quantity integer not null check (quantity > 0),
  reason text,
  customer_id uuid references public.customers (id),
  staff_id uuid references public.staff (id),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

-- current_quantity'yi atomik güncelleyen RPC. Uygulama katmanı stok
-- hareketi eklerken doğrudan tabloya değil, bu fonksiyona yazmalı.
create or replace function public.record_stock_movement(
  p_product_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_reason text default null,
  p_customer_id uuid default null,
  p_note text default null
)
returns public.stock_movements
language plpgsql
security definer set search_path = public
as $$
declare
  v_delta integer;
  v_row public.stock_movements;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  v_delta := case p_movement_type
    when 'in' then p_quantity
    when 'out' then -p_quantity
    when 'adjustment' then p_quantity
    else 0
  end;

  insert into public.stock_movements (product_id, movement_type, quantity, reason, customer_id, staff_id, note)
  values (p_product_id, p_movement_type, abs(p_quantity), p_reason, p_customer_id, auth.uid(), p_note)
  returning * into v_row;

  update public.products
  set current_quantity = greatest(0, current_quantity + v_delta),
      updated_at = now()
  where id = p_product_id;

  return v_row;
end;
$$;

-- =========================================================
-- 5. PAYMENTS (tahsilatlar)
-- =========================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'TRY',
  payment_method text not null default 'nakit' check (payment_method in ('nakit', 'kredi_karti', 'havale')),
  description text,
  staff_id uuid references public.staff (id),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists payments_customer_idx on public.payments (customer_id, paid_at desc);

-- =========================================================
-- 6. APPOINTMENTS (takvim: randevu + hatırlatma)
-- =========================================================
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  title text not null,
  notes text,
  scheduled_at timestamptz not null,
  status text not null default 'planned' check (status in ('planned', 'confirmed', 'completed', 'cancelled', 'no_show')),
  reminder_sent boolean not null default false,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_scheduled_idx on public.appointments (scheduled_at);
create index if not exists appointments_customer_idx on public.appointments (customer_id);

-- =========================================================
-- 7. WHATSAPP_TEMPLATES
-- =========================================================
create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.whatsapp_templates (name, body)
select 'Randevu Hatırlatma', 'Merhaba {{ad}}, {{tarih}} tarihindeki {{saat}} randevunuzu hatırlatmak isteriz. {{klinik_adi}}'
where not exists (select 1 from public.whatsapp_templates where name = 'Randevu Hatırlatma');

insert into public.whatsapp_templates (name, body)
select 'Bakım Zamanı', 'Merhaba {{ad}}, bakım zamanınız yaklaştı! Randevu almak için bizi arayabilirsiniz. {{klinik_adi}}'
where not exists (select 1 from public.whatsapp_templates where name = 'Bakım Zamanı');

insert into public.whatsapp_templates (name, body)
select 'Genel Bilgilendirme', 'Merhaba {{ad}}, {{klinik_adi}} olarak size ulaşmak istedik.'
where not exists (select 1 from public.whatsapp_templates where name = 'Genel Bilgilendirme');

-- =========================================================
-- updated_at otomatik güncelleme tetikleyicisi
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.customers;
create trigger set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.products;
create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.appointments;
create trigger set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.whatsapp_templates;
create trigger set_updated_at before update on public.whatsapp_templates
  for each row execute function public.set_updated_at();

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table public.staff enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.payments enable row level security;
alter table public.appointments enable row level security;
alter table public.whatsapp_templates enable row level security;

-- staff: herkes (giriş yapmış personel) okuyabilir; sadece admin yazabilir
drop policy if exists "staff_select" on public.staff;
create policy "staff_select" on public.staff for select
  using (auth.uid() is not null);

drop policy if exists "staff_update_admin" on public.staff;
create policy "staff_update_admin" on public.staff for update
  using (public.is_admin());

-- customers / stock_movements / payments / appointments:
-- tüm aktif personel okuyup yazabilir (küçük klinik, paylaşımlı güven modeli)
drop policy if exists "customers_all_staff" on public.customers;
create policy "customers_all_staff" on public.customers for all
  using (public.is_active_staff()) with check (public.is_active_staff());

drop policy if exists "stock_movements_all_staff" on public.stock_movements;
create policy "stock_movements_all_staff" on public.stock_movements for all
  using (public.is_active_staff()) with check (public.is_active_staff());

drop policy if exists "payments_all_staff" on public.payments;
create policy "payments_all_staff" on public.payments for all
  using (public.is_active_staff()) with check (public.is_active_staff());

drop policy if exists "appointments_all_staff" on public.appointments;
create policy "appointments_all_staff" on public.appointments for all
  using (public.is_active_staff()) with check (public.is_active_staff());

-- products / whatsapp_templates: herkes okuyabilir, sadece admin yazabilir
drop policy if exists "products_select" on public.products;
create policy "products_select" on public.products for select
  using (public.is_active_staff());

drop policy if exists "products_write_admin" on public.products;
create policy "products_write_admin" on public.products for insert
  with check (public.is_admin());
drop policy if exists "products_update_admin" on public.products;
create policy "products_update_admin" on public.products for update
  using (public.is_admin());
drop policy if exists "products_delete_admin" on public.products;
create policy "products_delete_admin" on public.products for delete
  using (public.is_admin());

drop policy if exists "wa_templates_select" on public.whatsapp_templates;
create policy "wa_templates_select" on public.whatsapp_templates for select
  using (public.is_active_staff());

drop policy if exists "wa_templates_write_admin" on public.whatsapp_templates;
create policy "wa_templates_write_admin" on public.whatsapp_templates for insert
  with check (public.is_admin());
drop policy if exists "wa_templates_update_admin" on public.whatsapp_templates;
create policy "wa_templates_update_admin" on public.whatsapp_templates for update
  using (public.is_admin());
drop policy if exists "wa_templates_delete_admin" on public.whatsapp_templates;
create policy "wa_templates_delete_admin" on public.whatsapp_templates for delete
  using (public.is_admin());

-- =========================================================
-- 8. CONGRESSES (kongreler / workshoplar)
-- =========================================================
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

-- Bitti. Şimdi Authentication > Users'tan ilk kullanıcınızı (kendi
-- e-postanız/şifreniz) oluşturun — otomatik olarak admin rolüyle
-- public.staff tablosuna eklenecektir.
