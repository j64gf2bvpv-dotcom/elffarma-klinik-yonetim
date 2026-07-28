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
