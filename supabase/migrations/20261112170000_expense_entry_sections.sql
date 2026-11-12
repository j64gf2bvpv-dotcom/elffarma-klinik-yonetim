-- Giderler bölümleri genişletildi (kullanıcı isteği, 2026-11-12: muhasebe gider tablosundaki
-- başlıklar birebir — doğalgaz, haberleşme, akaryakıt, kargo, hizmetler, kira, reklam,
-- konaklama, yemek-mutfak, araç kiralama/bakım, danışmanlık, diğer).
alter table public.expense_entries drop constraint if exists expense_entries_category_check;
alter table public.expense_entries add constraint expense_entries_category_check check (category in (
  'elektrik', 'su', 'dogalgaz', 'internet', 'haberlesme', 'ofis', 'mutfak', 'ofis_yemek', 'yemek_mutfak',
  'akaryakit', 'kargo', 'hizmet', 'kira', 'reklam', 'konaklama', 'arac_kiralama', 'arac_bakim',
  'danismanlik', 'diger'
));
