-- YENİ EKLENEN ÖZELLİKLER (tek seferde çalıştırın)
-- Satış Temsilcisi (isim bazlı, giriş gerektirmez) + Fatura Dosyası Ekleme

-- Satış temsilcileri (uygulama girişi olmadan isim bazlı liste)
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

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

alter table public.doctor_visits
  add column if not exists sales_rep_id uuid references public.sales_reps (id);

alter table public.doctor_visits
  drop column if exists staff_id;

comment on column public.doctor_visits.sales_rep_id is 'Personel girişi değil, serbest eklenen satış temsilcisi kaydı';
-- Tahsilatlara gerçek fatura dosyası ekleme (PDF/görsel) desteği
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.payments
  add column if not exists invoice_number text;

alter table public.payments
  add column if not exists invoice_file_path text;

comment on column public.payments.invoice_number is 'Fatura numarası (varsa)';
comment on column public.payments.invoice_file_path is 'Yüklenen fatura dosyasının Supabase Storage yolu';

-- Fatura dosyaları için özel (private) depolama alanı
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
