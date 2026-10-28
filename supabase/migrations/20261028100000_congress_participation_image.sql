-- Kongre katılım bilgileri görseli (kullanıcı isteği, 2026-10-28: "kongrelerde
-- katılım bilgileri görseli yüklenebilsin, oradan bilgiler çekilip yazılsın").
-- Fiyat/konaklama/kayıt koşullarını gösteren afiş ya da ekran görüntüsü;
-- kongre görseliyle aynı public bucket'ta (profile-images/congress/katilim/).
alter table public.congresses add column if not exists participation_image_url text;
