-- Araç listesinde arabanın küçük resmi (kullanıcı isteği, 2026-11-19). Bağlantı (ör. Wikimedia) ya da
-- Storage yolu tutulur.
alter table public.vehicles add column if not exists photo_url text;
