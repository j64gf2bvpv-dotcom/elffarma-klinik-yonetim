-- Günlük Sayım'a paket ile bağımsız bir flakon sayım paneli eklemek için:
-- her sayım kaleminin, o günkü referans (beklenen) flakon miktarını ve
-- kullanıcının elle girdiği sayılan flakon miktarını ayrı ayrı tutması
-- gerekiyor — aynen mevcut expected_quantity/counted_quantity (paket)
-- çiftinin flakon karşılığı.
alter table public.stock_count_items
  add column if not exists expected_quantity_flakon integer not null default 0,
  add column if not exists counted_quantity_flakon integer;
