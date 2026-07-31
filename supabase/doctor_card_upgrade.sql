-- Doktor Kartı'nı (Cari Kart) tüm ilgili modüllerle tam entegre hale getirir:
-- doktor ziyaretlerini gerçek cari karta bağlar, doktor başına dosya eki desteği ekler.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

-- Doktor ziyaretlerini gerçek cari karta bağla (mevcut doctor_name serbest metni
-- korunur — yeni doktor adayları hâlâ cari kartsız kaydedilebilir).
alter table public.doctor_visits add column if not exists customer_id uuid references public.customers (id) on delete set null;

-- Doktor Kartı'nda "Dosyalar" sekmesi için genel dosya ekleri.
create table if not exists public.customer_files (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  uploaded_by uuid references public.staff (id),
  created_at timestamptz not null default now()
);

alter table public.customer_files enable row level security;

drop policy if exists "customer_files_all_staff" on public.customer_files;
create policy "customer_files_all_staff" on public.customer_files for all
  using (public.is_active_staff()) with check (public.is_active_staff());

create index if not exists customer_files_customer_idx on public.customer_files (customer_id);

-- Dosyaların saklanacağı özel (private) depolama alanı — invoices bucket'ıyla aynı desen.
insert into storage.buckets (id, name, public)
select 'customer-files', 'customer-files', false
where not exists (select 1 from storage.buckets where id = 'customer-files');

drop policy if exists "customer_files_select_staff" on storage.objects;
create policy "customer_files_select_staff" on storage.objects for select
  using (bucket_id = 'customer-files' and auth.uid() is not null);

drop policy if exists "customer_files_insert_staff" on storage.objects;
create policy "customer_files_insert_staff" on storage.objects for insert
  with check (bucket_id = 'customer-files' and auth.uid() is not null);

drop policy if exists "customer_files_delete_staff" on storage.objects;
create policy "customer_files_delete_staff" on storage.objects for delete
  using (bucket_id = 'customer-files' and auth.uid() is not null);
