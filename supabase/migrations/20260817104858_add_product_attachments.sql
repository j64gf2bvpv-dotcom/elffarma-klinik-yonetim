-- Kullanıcı isteğiyle (2026-08-17): admin ürünlere PDF (katalog/broşür)
-- ekleyip satış elemanlarının görebilmesini istiyor — yeni bir tablo/bucket
-- açmadan, var olan genel `attachments` tablosunu (documents bucket, aynı
-- imzalı-URL deseni) 'product' owner_type'ıyla genişletiyoruz.
alter table public.attachments drop constraint if exists attachments_owner_type_check;
alter table public.attachments
  add constraint attachments_owner_type_check
  check (owner_type = any (array['customer', 'clinic', 'congress', 'workshop', 'doctor_visit', 'product']));

-- Diğer owner_type'lar (doktor/klinik/kongre belgeleri) herkese açık kalıyor
-- (shared-trust) — sadece 'product' için yükleme/silme admin'e özel,
-- görüntüleme (select) yine tüm personelde (satış elemanları PDF'i açabilsin).
drop policy if exists "attachments_all_staff" on public.attachments;

drop policy if exists "attachments_select_staff" on public.attachments;
create policy "attachments_select_staff" on public.attachments for select
  using (public.is_active_staff());

drop policy if exists "attachments_insert_staff" on public.attachments;
create policy "attachments_insert_staff" on public.attachments for insert
  with check (public.is_active_staff() and (owner_type <> 'product' or public.is_admin()));

drop policy if exists "attachments_update_staff" on public.attachments;
create policy "attachments_update_staff" on public.attachments for update
  using (public.is_active_staff() and (owner_type <> 'product' or public.is_admin()));

drop policy if exists "attachments_delete_staff" on public.attachments;
create policy "attachments_delete_staff" on public.attachments for delete
  using (public.is_active_staff() and (owner_type <> 'product' or public.is_admin()));
