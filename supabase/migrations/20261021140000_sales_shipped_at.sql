-- Stok > Doktor Hesapları: aldığı ürünlerde "Kargoya verildi" işareti
-- (kullanıcı isteği, 2026-10-21: "kargoya verildi verilmedi tiki olmalı, hangi
-- ürünler verildi hangisi verilmedi tikleyip seçmeliyim, kalan ürünlerde
-- görünmeli"). NULL = henüz verilmedi (Kalan Ürünler'de görünür), dolu =
-- kargoya verildiği an. Stoka dokunmaz — satış zaten stoktan düşmüş olur;
-- Kargo sekmesindeki gönderimlerden bağımsızdır (orası ayrıca stok düşer).

alter table public.sales add column if not exists shipped_at timestamptz;
