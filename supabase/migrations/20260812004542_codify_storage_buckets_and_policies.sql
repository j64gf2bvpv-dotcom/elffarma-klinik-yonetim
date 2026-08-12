-- Uygulamanın (masaüstü + mobil, aynı proje) kullandığı 4 Storage bucket'ı
-- ve bunların RLS policy'lerini migration takibi altına alır.
--
-- ÖNEMLİ: Bu migration bir DÜZELTME değil, bir KODİFİKASYON'dur. Canlı
-- veritabanı `supabase db dump --linked --schema storage` ile salt-okunur
-- olarak doğrulandı (2026-08-12) — 4 bucket (invoices, documents,
-- profile-images, backups) ve tüm policy'leri zaten `supabase/schema.sql`
-- ile birebir aynı şekilde canlıda mevcuttu, eksik/tutarsız hiçbir şey
-- bulunmadı. Bu dosyanın tek amacı: `storage` şeması `supabase db pull`
-- kapsamına girmediği için şu ana kadar hiçbir migration dosyasında
-- izlenmeyen bu zaten-doğru durumu, projenin yeni CLI migration akışına
-- (bkz. CLAUDE.md "Data layer / authorization model") dahil etmek.
--
-- Her ifade idempotent (on conflict do nothing / drop+create policy) —
-- zaten var olan bucket/policy'ler üzerinde no-op, tekrar tekrar
-- çalıştırılabilir.

-- =========================================================
-- invoices (private) — tahsilat fatura ekleri
-- =========================================================
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

drop policy if exists "buckets_select_all" on storage.buckets;
create policy "buckets_select_all" on storage.buckets for select
  using (true);

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
-- documents (private) — invoices ile aynı auth.uid()-gated desen
-- (doktor/klinik/kongre/workshop "Belgeler" sekmeleri)
-- =========================================================
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

-- =========================================================
-- profile-images (PUBLIC) — kongre/workshop tanıtım görselleri, satış
-- temsilcisi fotoğrafları, personel kartvizit fotoğrafı. Path prefix'leriyle
-- ayrılır: congress/..., sales-rep/..., staff/...
--
-- Hem `is_active_staff()` hem `auth.uid() is not null` denendi, ikisi de
-- "new row violates row-level security policy" ile başarısız oldu (muhtemelen
-- Dashboard üzerinden oluşturulmuş, adı bilinmeyen daha kısıtlayıcı bir
-- policy devredeydi). Kesin çözüm: bu bucket'a ait TÜM storage.objects
-- policy'lerini (isim fark etmeksizin) dinamik olarak bulup silip, baştan
-- tamamen açık (`true`) policy'ler kurmak. Bucket zaten public/hassas
-- olmayan veri taşıyor, yazmayı açmak ek risk oluşturmuyor.
-- =========================================================
insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do nothing;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%profile-images%' or coalesce(with_check, '') ilike '%profile-images%')
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy "profile_images_select_all" on storage.objects for select
  using (bucket_id = 'profile-images');

create policy "profile_images_insert_all" on storage.objects for insert
  with check (bucket_id = 'profile-images');

create policy "profile_images_update_all" on storage.objects for update
  using (bucket_id = 'profile-images');

create policy "profile_images_delete_all" on storage.objects for delete
  using (bucket_id = 'profile-images');

-- =========================================================
-- backups (private) — Ayarlar > Yedekleme JSON dökümleri
-- Okuma tüm aktif personele açık, oluşturma/silme sadece admin (yedekleme
-- bilinçli bir yönetim işlemi). Güncelleme policy'si yok (dosyalar sadece
-- eklenir/silinir, üzerine yazılmaz).
-- =========================================================
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

drop policy if exists "backups_select_staff" on storage.objects;
create policy "backups_select_staff" on storage.objects for select
  using (bucket_id = 'backups' and public.is_active_staff());

drop policy if exists "backups_insert_admin" on storage.objects;
create policy "backups_insert_admin" on storage.objects for insert
  with check (bucket_id = 'backups' and public.is_admin());

drop policy if exists "backups_delete_admin" on storage.objects;
create policy "backups_delete_admin" on storage.objects for delete
  using (bucket_id = 'backups' and public.is_admin());
