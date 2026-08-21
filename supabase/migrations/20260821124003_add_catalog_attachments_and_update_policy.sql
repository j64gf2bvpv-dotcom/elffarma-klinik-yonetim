-- Kullanıcı isteğiyle (2026-08-21): "Yeni Katalog Ekle" (Dermakor/Swiss gibi
-- ürün hattı grupları) diyaloğuna PDF/resim ekleme + katalogları düzenleme
-- (yeniden adlandırma) ve silme eklendi.
--
-- 1) product_catalogs'ta SADECE select/insert/delete policy'leri vardı,
-- update HİÇ YOKTU — RLS'de policy olmayan işlem sessizce reddedilir, yeniden
-- adlandırma özelliği bu politika olmadan çalışmazdı.
drop policy if exists "product_catalogs_update_admin" on public.product_catalogs;
create policy "product_catalogs_update_admin" on public.product_catalogs for update
  using (public.is_admin()) with check (public.is_admin());

-- 2) attachments'a (mevcut genel belge mekanizması, 'product' owner_type'ıyla
-- aynı desen) yeni bir owner_type: 'product_catalog'. Yükleme/silme/düzenleme
-- admin'e özel, görüntüleme tüm personelde (aynı 'product' kuralı).
alter table public.attachments drop constraint if exists attachments_owner_type_check;
alter table public.attachments
  add constraint attachments_owner_type_check
  check (owner_type = any (array['customer', 'clinic', 'congress', 'workshop', 'doctor_visit', 'product', 'product_catalog']));

drop policy if exists "attachments_insert_staff" on public.attachments;
create policy "attachments_insert_staff" on public.attachments for insert
  with check (public.is_active_staff() and (owner_type not in ('product', 'product_catalog') or public.is_admin()));

drop policy if exists "attachments_update_staff" on public.attachments;
create policy "attachments_update_staff" on public.attachments for update
  using (public.is_active_staff() and (owner_type not in ('product', 'product_catalog') or public.is_admin()));

drop policy if exists "attachments_delete_staff" on public.attachments;
create policy "attachments_delete_staff" on public.attachments for delete
  using (public.is_active_staff() and (owner_type not in ('product', 'product_catalog') or public.is_admin()));
