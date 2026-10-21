-- Kongreler: web sitesi adresi (kullanıcı isteği, 2026-10-21: "web sitesi
-- üzerinden bağlanabilsin, gerçek bilgiler çekilebilsin"). Detay sayfasında
-- bağlantı olarak gösterilir; formda "Siteden bilgileri getir" bu adresi okur.
alter table public.congresses add column if not exists website_url text;
