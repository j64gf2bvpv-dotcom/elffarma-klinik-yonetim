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

-- =========================================================
-- 9. SALES_REPS (satış temsilcileri — uygulama girişi olmadan isim bazlı liste)
-- =========================================================
create table if not exists public.sales_reps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.sales_reps enable row level security;

drop policy if exists "sales_reps_all_staff" on public.sales_reps;
create policy "sales_reps_all_staff" on public.sales_reps for all
  using (public.is_active_staff()) with check (public.is_active_staff());

-- =========================================================
-- 10. DOCTOR_VISITS (doktor ziyaret listesi — satış temsilcileri, haftalık, gün gün)
-- =========================================================
create table if not exists public.doctor_visits (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null default current_date,
  doctor_name text not null,
  phone text,
  email text,
  social_media text,
  notes text,
  sales_rep_id uuid references public.sales_reps (id),
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

-- Bu modül ilk sürümde personel (staff_id) bazlı oluşturulmuştu, sonradan
-- personel girişi gerektirmeyen serbest satış temsilcisi modeline geçildi.
-- Zaten var olan kurulumlarda bu iki satır geçişi tamamlar (yeni kurulumlarda
-- sales_rep_id yukarıdaki create table ile zaten mevcut, staff_id hiç var olmaz).
alter table public.doctor_visits
  add column if not exists sales_rep_id uuid references public.sales_reps (id);
alter table public.doctor_visits
  drop column if exists staff_id;

-- =========================================================
-- 11. STOCK_COUNTS / STOCK_COUNT_ITEMS (günlük stok sayımı)
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
-- 12. CUSTOMER_PENDING_PRODUCTS (doktora götürülüp henüz teslim edilmemiş ürünler)
-- =========================================================
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

-- =========================================================
-- 13. CONGRESS_REMAINING_PRODUCTS (kongreye götürülüp doktora dağıtılmayan kalan ürünler)
-- =========================================================
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

-- =========================================================
-- 14. EXPENSES (giderler)
-- =========================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('hizmet_gideri', 'diger')),
  amount numeric(12, 2) not null check (amount > 0),
  description text,
  expense_date timestamptz not null default now(),
  staff_id uuid references public.staff (id),
  created_at timestamptz not null default now()
);
create index if not exists expenses_expense_date_idx on public.expenses (expense_date desc);
create index if not exists expenses_category_idx on public.expenses (category);

alter table public.expenses enable row level security;

drop policy if exists "expenses_all_staff" on public.expenses;
create policy "expenses_all_staff" on public.expenses for all
  using (public.is_active_staff()) with check (public.is_active_staff());

-- =========================================================
-- 15. BUDGET_TARGETS (bütçe yılı — aylık ciro hedefleri)
-- =========================================================
create table if not exists public.budget_targets (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  target_revenue numeric(12, 2) not null default 0,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);
create index if not exists budget_targets_year_idx on public.budget_targets (year);

alter table public.budget_targets enable row level security;

drop policy if exists "budget_targets_all_staff" on public.budget_targets;
create policy "budget_targets_all_staff" on public.budget_targets for all
  using (public.is_active_staff()) with check (public.is_active_staff());

comment on table public.budget_targets is 'Yıllık/aylık ciro bütçe hedefleri (Bütçe Yılı modülü)';

-- =========================================================
-- 16. INVOICES (Satışlar > Faturalar sekmesi — basit iç fatura kayıtları)
-- =========================================================
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

-- =========================================================
-- 17. REMINDERS (hatırlatmalar ve ajanda)
-- =========================================================
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  note text,
  due_date date not null,
  is_done boolean not null default false,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now()
);
create index if not exists reminders_due_date_idx on public.reminders (due_date);

alter table public.reminders enable row level security;

drop policy if exists "reminders_all_staff" on public.reminders;
create policy "reminders_all_staff" on public.reminders for all
  using (public.is_active_staff()) with check (public.is_active_staff());

comment on table public.reminders is 'Ödeme, kongre ve görev hatırlatmaları (Hatırlatmalar ve Ajanda modülleri)';

-- =========================================================
-- 18. SALES (kongre dışı genel ürün satışları / iadeleri)
-- =========================================================
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

-- =========================================================
-- 19. APP_SETTINGS (admin tarafından düzenlenebilen genel uygulama ayarları)
-- =========================================================
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_staff" on public.app_settings;
create policy "app_settings_select_staff" on public.app_settings for select
  using (public.is_active_staff());

drop policy if exists "app_settings_insert_admin" on public.app_settings;
create policy "app_settings_insert_admin" on public.app_settings for insert
  with check (public.is_admin());

drop policy if exists "app_settings_update_admin" on public.app_settings;
create policy "app_settings_update_admin" on public.app_settings for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "app_settings_delete_admin" on public.app_settings;
create policy "app_settings_delete_admin" on public.app_settings for delete
  using (public.is_admin());

-- =========================================================
-- 20. MEVCUT TABLOLARA SONRADAN EKLENEN ALANLAR
-- =========================================================

-- customers (doktorlar): fatura/tahsilat bilgileri, ödeme vadesi, toplam borç, Şahıs/Hastane tipi
alter table public.customers add column if not exists tc_no text;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists tax_number text;
alter table public.customers add column if not exists vat_rate numeric(5, 2);
alter table public.customers add column if not exists preferred_payment_method text;
alter table public.customers drop constraint if exists customers_preferred_payment_method_check;
alter table public.customers add constraint customers_preferred_payment_method_check
  check (preferred_payment_method is null or preferred_payment_method in ('nakit', 'kredi_karti', 'havale'));

alter table public.customers add column if not exists next_payment_due date;
alter table public.customers add column if not exists total_debt numeric(10, 2);

alter table public.customers add column if not exists doctor_type text not null default 'sahis';
alter table public.customers drop constraint if exists customers_doctor_type_check;
alter table public.customers add constraint customers_doctor_type_check
  check (doctor_type in ('sahis', 'hastane'));
alter table public.customers add column if not exists province text;
alter table public.customers add column if not exists hospital_name text;

comment on column public.customers.tc_no is 'Opsiyonel: doktorun TC Kimlik Numarası';
comment on column public.customers.address is 'Opsiyonel: doktorun/hastanenin fatura adresi';
comment on column public.customers.tax_number is 'Opsiyonel: vergi numarası';
comment on column public.customers.vat_rate is 'Opsiyonel: KDV oranı (%)';
comment on column public.customers.preferred_payment_method is 'Opsiyonel: tercih edilen ödeme şekli (nakit/kredi_karti/havale)';
comment on column public.customers.next_payment_due is 'Opsiyonel: doktorun bir sonraki ödeme vadesi tarihi';
comment on column public.customers.total_debt is 'Opsiyonel: doktorla anlaşılan toplam tutar/borç — kalan tahsilat bundan hesaplanır';
comment on column public.customers.doctor_type is 'sahis: şahıs doktor, hastane: hastane bünyesinde çalışan doktor';
comment on column public.customers.province is 'Doktorun bulunduğu il';
comment on column public.customers.hospital_name is 'doctor_type = hastane ise bağlı olduğu hastane adı';

-- products: son kullanım tarihi, barkod, marka hattı, görsel
alter table public.products add column if not exists expiry_date date;
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists brand_line text;
alter table public.products drop constraint if exists products_brand_line_check;
alter table public.products add constraint products_brand_line_check
  check (brand_line is null or brand_line in ('dermakor', 'swiss'));
alter table public.products add column if not exists image_url text;

comment on column public.products.expiry_date is 'Opsiyonel: ürünün son kullanım tarihi';
comment on column public.products.barcode is 'Opsiyonel: ürün barkod numarası';
comment on column public.products.brand_line is 'Opsiyonel: dermakor veya swiss ürün hattı';
comment on column public.products.image_url is 'Ürün küçük görsel adresi (üretici sitesinden)';

-- congresses: katılım planı, görsel, paket fiyatları
alter table public.congresses add column if not exists will_attend boolean not null default false;
alter table public.congresses add column if not exists image_url text;
alter table public.congresses add column if not exists single_person_price numeric(10, 2);
alter table public.congresses add column if not exists two_person_price numeric(10, 2);

comment on column public.congresses.will_attend is 'Bu kongreye katılım planlanıyor mu (true) — uygulamada uyarı rozetiyle gösterilir';
comment on column public.congresses.single_person_price is 'Opsiyonel: tek kişi katılım paket fiyatı';
comment on column public.congresses.two_person_price is 'Opsiyonel: 2 kişi katılım paket fiyatı';

-- congress_participant_products: bu ürünü satan satış temsilcisi
alter table public.congress_participant_products add column if not exists sales_rep_id uuid references public.sales_reps (id);
comment on column public.congress_participant_products.sales_rep_id is 'Bu ürünü doktora satan satış temsilcisi';

-- payments: fatura dosyası + satış temsilcisi
alter table public.payments add column if not exists invoice_number text;
alter table public.payments add column if not exists invoice_file_path text;
alter table public.payments add column if not exists sales_rep_id uuid references public.sales_reps (id);

comment on column public.payments.invoice_number is 'Fatura numarası (varsa)';
comment on column public.payments.invoice_file_path is 'Yüklenen fatura dosyasının Supabase Storage yolu';
comment on column public.payments.sales_rep_id is 'Bu tahsilatı/satışı yapan satış temsilcisi';

-- stock_movements: silinen doktora referans artık boşa düşsün (denetim kaydı korunur)
alter table public.stock_movements drop constraint if exists stock_movements_customer_id_fkey;
alter table public.stock_movements add constraint stock_movements_customer_id_fkey
  foreign key (customer_id) references public.customers (id) on delete set null;

-- =========================================================
-- 21. FATURA DOSYALARI STORAGE BUCKET (private, tahsilat fatura ekleri için)
-- =========================================================
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

drop policy if exists "invoices_select_staff" on storage.objects;
create policy "invoices_select_staff" on storage.objects for select
  using (bucket_id = 'invoices' and auth.uid() is not null);

drop policy if exists "invoices_insert_staff" on storage.objects;
create policy "invoices_insert_staff" on storage.objects for insert
  with check (bucket_id = 'invoices' and auth.uid() is not null);

drop policy if exists "invoices_update_staff" on storage.objects;
create policy "invoices_update_staff" on storage.objects for update
  using (bucket_id = 'invoices' and auth.uid() is not null);

drop policy if exists "invoices_delete_staff" on storage.objects;
create policy "invoices_delete_staff" on storage.objects for delete
  using (bucket_id = 'invoices' and auth.uid() is not null);

-- =========================================================
-- 23. AI ALTYAPISI (AIService — sağlayıcıdan bağımsız konuşma geçmişi + kullanım logları)
-- =========================================================
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Yeni Konuşma',
  provider text,
  model text,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.ai_conversations;
create trigger set_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

alter table public.ai_conversations enable row level security;

drop policy if exists "ai_conversations_all_staff" on public.ai_conversations;
create policy "ai_conversations_all_staff" on public.ai_conversations for all
  using (public.is_active_staff()) with check (public.is_active_staff());

comment on table public.ai_conversations is 'AIService üzerinden yürütülen konuşmaların üst kaydı (sağlayıcıdan bağımsız)';

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_conversation_id_idx on public.ai_messages (conversation_id);

alter table public.ai_messages enable row level security;

drop policy if exists "ai_messages_all_staff" on public.ai_messages;
create policy "ai_messages_all_staff" on public.ai_messages for all
  using (public.is_active_staff()) with check (public.is_active_staff());

comment on table public.ai_messages is 'Bir AI konuşmasındaki tek tek mesajlar (kullanıcı/asistan/sistem)';

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  success boolean not null,
  duration_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  error_message text,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_logs_created_at_idx on public.ai_usage_logs (created_at);

alter table public.ai_usage_logs enable row level security;

drop policy if exists "ai_usage_logs_select_staff" on public.ai_usage_logs;
create policy "ai_usage_logs_select_staff" on public.ai_usage_logs for select
  using (public.is_active_staff());

drop policy if exists "ai_usage_logs_insert_staff" on public.ai_usage_logs;
create policy "ai_usage_logs_insert_staff" on public.ai_usage_logs for insert
  with check (public.is_active_staff());

comment on table public.ai_usage_logs is 'AIService çağrılarının denetim/hata/performans kaydı — düzenlenmez, sadece eklenir';

-- =========================================================
-- 24. DOKTOR/KLİNİK/BÖLGE/TEMSİLCİ (Faz 1 ERP genişletmesi)
-- =========================================================

-- REGIONS: sınırsız/iç içe bölge ağacı (şehir → ilçe)
create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_region_id uuid references public.regions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists regions_parent_idx on public.regions (parent_region_id);

alter table public.regions enable row level security;
drop policy if exists "regions_all_staff" on public.regions;
create policy "regions_all_staff" on public.regions for all
  using (public.is_active_staff()) with check (public.is_active_staff());

-- CLINICS: doktorların bağlı olduğu klinik/hastane kartı
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  authorized_persons text,
  address text,
  phone text,
  tax_office text,
  tax_number text,
  employee_count integer,
  branch_count integer,
  sales_rep_id uuid references public.sales_reps (id) on delete set null,
  region_id uuid references public.regions (id) on delete set null,
  category text,
  is_vip boolean not null default false,
  risk_limit numeric(12, 2),
  discount_rate numeric(5, 2),
  payment_method text,
  working_days text[] not null default '{}',
  maps_url text,
  notes text,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinics_name_idx on public.clinics using gin (to_tsvector('simple', name));

drop trigger if exists set_updated_at on public.clinics;
create trigger set_updated_at before update on public.clinics
  for each row execute function public.set_updated_at();

alter table public.clinics enable row level security;
drop policy if exists "clinics_all_staff" on public.clinics;
create policy "clinics_all_staff" on public.clinics for all
  using (public.is_active_staff()) with check (public.is_active_staff());

-- ATTACHMENTS: doktor/klinik/kongre/workshop "Belgeler" sekmeleri için tek genel dosya-eki tablosu
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('customer', 'clinic', 'congress', 'workshop')),
  owner_id uuid not null,
  file_path text not null,
  file_name text not null,
  uploaded_by uuid references public.staff (id),
  created_at timestamptz not null default now()
);
create index if not exists attachments_owner_idx on public.attachments (owner_type, owner_id);

alter table public.attachments enable row level security;
drop policy if exists "attachments_all_staff" on public.attachments;
create policy "attachments_all_staff" on public.attachments for all
  using (public.is_active_staff()) with check (public.is_active_staff());

-- documents storage bucket (private, invoices bucket ile aynı auth.uid()-gated desen)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_select_staff" on storage.objects;
create policy "documents_select_staff" on storage.objects for select
  using (bucket_id = 'documents' and auth.uid() is not null);

drop policy if exists "documents_insert_staff" on storage.objects;
create policy "documents_insert_staff" on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid() is not null);

drop policy if exists "documents_update_staff" on storage.objects;
create policy "documents_update_staff" on storage.objects for update
  using (bucket_id = 'documents' and auth.uid() is not null);

drop policy if exists "documents_delete_staff" on storage.objects;
create policy "documents_delete_staff" on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid() is not null);

-- customers (doktorlar): klinik/bölge/temsilci bağlantısı + genişletilmiş iletişim/idari alanlar
alter table public.customers add column if not exists specialty text;
alter table public.customers add column if not exists clinic_id uuid references public.clinics (id) on delete set null;
alter table public.customers add column if not exists mobile_phone text;
alter table public.customers add column if not exists whatsapp_phone text;
alter table public.customers add column if not exists website text;
alter table public.customers add column if not exists instagram text;
alter table public.customers add column if not exists district text;
alter table public.customers add column if not exists tax_office text;
alter table public.customers add column if not exists assistant_info text;
alter table public.customers add column if not exists secretary_info text;
alter table public.customers add column if not exists referrer text;
alter table public.customers add column if not exists sales_rep_id uuid references public.sales_reps (id) on delete set null;
alter table public.customers add column if not exists region_id uuid references public.regions (id) on delete set null;
alter table public.customers add column if not exists is_active boolean not null default true;
alter table public.customers add column if not exists photo_url text;

-- doctor_code: otomatik "DOC-000001" formatında, geriye dönük mevcut kayıtlar da doldurulur
alter table public.customers add column if not exists doctor_code text;
alter table public.customers drop constraint if exists customers_doctor_code_key;
alter table public.customers add constraint customers_doctor_code_key unique (doctor_code);

create sequence if not exists public.doctor_code_seq;

with numbered as (
  select id, row_number() over (order by created_at) as rn
  from public.customers
  where doctor_code is null
)
update public.customers c
set doctor_code = 'DOC-' || lpad(n.rn::text, 6, '0')
from numbered n
where c.id = n.id;

select setval('public.doctor_code_seq', greatest((select count(*) from public.customers), 1), true);

create or replace function public.set_doctor_code()
returns trigger
language plpgsql
as $$
begin
  if new.doctor_code is null then
    new.doctor_code := 'DOC-' || lpad(nextval('public.doctor_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists set_doctor_code on public.customers;
create trigger set_doctor_code before insert on public.customers
  for each row execute function public.set_doctor_code();

-- sales_reps: özlük/performans alanları + bölge bağlantısı
alter table public.sales_reps add column if not exists photo_url text;
alter table public.sales_reps add column if not exists email text;
alter table public.sales_reps add column if not exists vehicle_info text;
alter table public.sales_reps add column if not exists license_info text;
alter table public.sales_reps add column if not exists hire_date date;
alter table public.sales_reps add column if not exists commission_rate numeric(5, 2);
alter table public.sales_reps add column if not exists salary numeric(12, 2);
alter table public.sales_reps add column if not exists bank_info text;
alter table public.sales_reps add column if not exists sales_target numeric(12, 2);
alter table public.sales_reps add column if not exists region_id uuid references public.regions (id) on delete set null;

-- Bitti. Şimdi Authentication > Users'tan ilk kullanıcınızı (kendi
-- e-postanız/şifreniz) oluşturun — otomatik olarak admin rolüyle
-- public.staff tablosuna eklenecektir.
