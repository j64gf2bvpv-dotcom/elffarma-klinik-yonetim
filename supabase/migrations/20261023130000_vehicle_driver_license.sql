-- Ehliyet, araç tablosunda Plaka'dan sonra bir sütun olarak (kullanıcı isteği,
-- 2026-10-23: "ehliyet kısmı plakalardan sonra olsun, o kısma eklensin") — aracı
-- kullanan personelin ehliyetinin ön/arka yüz fotoğrafı araç kaydında tutulur.
-- Az önce açılan ayrı driver_licenses tablosu (yalnızca silinen bir deneme kaydı
-- vardı, şu an boş) kaldırılıyor. Fotoğraflar private 'documents' bucket'ında.

alter table public.vehicles
  add column if not exists license_front_path text,
  add column if not exists license_back_path text;

drop table if exists public.driver_licenses;
