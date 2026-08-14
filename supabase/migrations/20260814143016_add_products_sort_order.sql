-- Kullanıcı isteği: Stok > Ürünler'de ürünleri sürükleyip elle sıralayabilsin
-- (önceden her zaman isme göre alfabetik sıralanıyordu). Yeni ürünler NULL
-- sort_order ile başlar — sıralama sorgusunda NULL'lar sona (nullsFirst:
-- false) düşer, yani yeni eklenen bir ürün elle taşınana kadar listenin en
-- sonunda görünür.
alter table public.products
  add column if not exists sort_order integer;

-- Geriye dönük: mevcut ürünler ürün hattı (Dermakor/Swiss/hiçbiri) içinde
-- şu anki alfabetik sırasına göre 10, 20, 30... numaralandırılıyor (aralarda
-- boşluk bırakmak ileride araya eklemeyi kolaylaştırır) — böylece geçiş
-- sırasında listenin görünümü ANİDEN değişmiyor.
with numbered as (
  select id, row_number() over (partition by brand_line order by name) * 10 as rn
  from public.products
)
update public.products p
set sort_order = numbered.rn
from numbered
where p.id = numbered.id;

notify pgrst, 'reload schema';
