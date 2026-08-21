-- Büyük PDF'ler "Belgeler" sekmelerine (doktor/klinik/kongre/workshop/ürün)
-- yüklenirken projenin varsayılan 50MB sınırına takılıp hata veriyordu
-- (kullanıcı isteğiyle, 2026-08-22 — "pdf yükleme boyutunda sınır olmasın").
-- storage.buckets.file_size_limit her bucket için doğrudan ayarlanabilen
-- gerçek bir sütun; supabase/config.toml'daki [storage] bloğu (local dev
-- config) ile karıştırılmasın — bu ikisi ayrı, config.toml'u remote'a
-- `supabase config push` ile göndermek auth gibi ilgisiz servisleri de
-- etkileyebiliyor (fark edildi, 2026-08-22), bu yüzden burada SADECE
-- storage.buckets tablosu hedefleniyor.
update storage.buckets
set file_size_limit = 1073741824 -- 1 GiB
where id in ('invoices', 'documents');
