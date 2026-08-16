-- Siparişler (sales) tablosuna durum takibi ekler — mobil "Siparişler"
-- ekranının Bekleyen/Onaylandı/Tamamlandı filtrelerini destekler
-- (kullanıcı isteğiyle, 2026-08-17). Mevcut kayıtlar geriye dönük olarak
-- 'onaylandi' kabul edilir (zaten gerçekleşmiş satış/iade kayıtları,
-- onay sürecine tabi tutulmadan önce girilmişti).

alter table public.sales
  add column status text not null default 'bekleyen';

alter table public.sales
  add constraint sales_status_check
  check (status = any (array['bekleyen'::text, 'onaylandi'::text, 'tamamlandi'::text]));

update public.sales set status = 'onaylandi' where status = 'bekleyen';

create index sales_status_idx on public.sales (status);
