-- Kullanıcı isteğiyle (2026-08-24): "bütün kullanıcılarda stoklar/ürünler
-- ortak olmalı, değişiklik yapıldığında her kullanıcıya yansımalı." Veri
-- zaten TEK bir paylaşımlı veritabanında tutuluyordu ama istemci tarafında
-- önbelleğe alınıyordu (TanStack Query, staleTime 30sn) — bir kullanıcının
-- değişikliği, o an ekranı açık olan BAŞKA bir kullanıcıda ancak doğal bir
-- yeniden-sorgu tetiklenince (pencere odağı, 30sn+ sonra, sayfa değiştirme)
-- görünüyordu. Hiçbir tablo supabase_realtime publication'ına eklenmemişti
-- (kontrol edildi — boş), yani gerçek zamanlı senkron hiç yoktu. Bu, ürün/
-- stok verisini gerçek zamanlı hale getirmenin ön koşulu; istemci tarafı
-- dinleyici (useStockRealtimeSync) ayrı bir commit'te.
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.stock_movements;
alter publication supabase_realtime add table public.stock_count_items;
alter publication supabase_realtime add table public.stock_counts;
