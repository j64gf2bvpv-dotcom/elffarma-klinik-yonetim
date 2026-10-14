-- Bütün veri girişlerini bütün (aktif) kullanıcılar yapabilsin (kullanıcı
-- isteği, 2026-10-14: "BÜTÜN VERİ GİRİŞLERİNİ BÜTÜN kullanıcılar giriş
-- yapabilsin"). Veri tabloları is_admin() yerine is_active_staff()'a açılıyor.
-- BİLEREK yönetici-only KALANLAR (veri girişi değil, sistem/yetki işleri):
-- staff (rol atama — açılırsa herkes kendini yönetici yapabilirdi),
-- app_settings, admin_secrets, ai_shared_keys, audit_logs, yedek deposu ve
-- "tüm hareketleri/satışları sil" gibi toplu silme RPC'leri.

-- Ürünler: ekleme / silme personele; sütun koruma tetikleyicisi kaldırılıyor
-- (artık her alanı — stok miktarı RPC dışında zaten değiştirilmiyor — personel
-- de düzenleyebilir). Fonksiyon, stok RPC'lerinin set_config çağrıları
-- bozulmasın diye yerinde bırakılıyor, sadece tetikleyici düşürülüyor.
drop trigger if exists products_staff_editable_columns_guard on public.products;

drop policy if exists products_write_admin on public.products;
create policy products_write_admin on public.products for insert
  with check (public.is_active_staff());
drop policy if exists products_delete_admin on public.products;
create policy products_delete_admin on public.products for delete
  using (public.is_active_staff());

-- Kataloglar (Dermakor / Swiss gibi marka grupları)
drop policy if exists "product_catalogs_write_admin" on public.product_catalogs;
create policy "product_catalogs_write_admin" on public.product_catalogs for insert
  with check (public.is_active_staff());
drop policy if exists "product_catalogs_update_admin" on public.product_catalogs;
create policy "product_catalogs_update_admin" on public.product_catalogs for update
  using (public.is_active_staff()) with check (public.is_active_staff());
drop policy if exists "product_catalogs_delete_admin" on public.product_catalogs;
create policy "product_catalogs_delete_admin" on public.product_catalogs for delete
  using (public.is_active_staff());

-- WhatsApp şablonları
drop policy if exists wa_templates_write_admin on public.whatsapp_templates;
create policy wa_templates_write_admin on public.whatsapp_templates for insert
  with check (public.is_active_staff());
drop policy if exists wa_templates_update_admin on public.whatsapp_templates;
create policy wa_templates_update_admin on public.whatsapp_templates for update
  using (public.is_active_staff());
drop policy if exists wa_templates_delete_admin on public.whatsapp_templates;
create policy wa_templates_delete_admin on public.whatsapp_templates for delete
  using (public.is_active_staff());

-- Ziyaret planları
drop policy if exists visit_plans_admin_write on public.visit_plans;
create policy visit_plans_admin_write on public.visit_plans
  using (public.is_active_staff())
  with check (public.is_active_staff());

-- Ürün / katalog ekleri (dosyalar)
drop policy if exists "attachments_insert_staff" on public.attachments;
create policy "attachments_insert_staff" on public.attachments for insert
  with check (public.is_active_staff());
drop policy if exists "attachments_update_staff" on public.attachments;
create policy "attachments_update_staff" on public.attachments for update
  using (public.is_active_staff());
drop policy if exists "attachments_delete_staff" on public.attachments;
create policy "attachments_delete_staff" on public.attachments for delete
  using (public.is_active_staff());

-- Araçlar: listede olmayan kullanan kişinin adı elle yazılabilsin
-- (kullanıcı isteği, 2026-10-14: "araç ekle kısmında isimleri manuel ekleme
-- yapabilmeliyim"). sales_rep_id seçiliyse o öncelikli gösterilir.
alter table public.vehicles add column if not exists driver_name text;
comment on column public.vehicles.driver_name is 'Kullanan kişi (elle yazılan, satış temsilcisi listesinde yoksa)';
