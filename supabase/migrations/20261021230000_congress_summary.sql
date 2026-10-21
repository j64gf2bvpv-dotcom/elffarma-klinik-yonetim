-- Kongreler: kısa açıklama (kullanıcı isteği, 2026-10-21: "kongreler kısmında
-- kongreyle ilgili kısa açıklama olsun, web sitelerinden çek"). Kartlarda ve
-- detay başlığında gösterilir; web sitesinden (meta açıklama + sayfa metni,
-- yapay zekâ ile Türkçe 1-2 cümle) doldurulur, elle de düzenlenebilir.
alter table public.congresses add column if not exists summary text;
