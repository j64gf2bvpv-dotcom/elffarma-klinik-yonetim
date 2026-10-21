-- Doktor Hesapları: kısmi kargo (kullanıcı isteği, 2026-10-21: "toplam adetten
-- eksik olanlar kalan bölümüne, beklemede kısmına işlensin"). Bir satışın kaç
-- adedinin kargoya verildiği; kalan = quantity - shipped_quantity "Beklemede"
-- görünür. shipped_at (20261021140000) son kargo tarihi olarak kalır.
-- Stoka dokunmaz.

alter table public.sales add column if not exists shipped_quantity integer not null default 0;

alter table public.sales drop constraint if exists sales_shipped_quantity_range;
alter table public.sales add constraint sales_shipped_quantity_range
  check (shipped_quantity >= 0 and shipped_quantity <= quantity);

-- Daha önce "Kargoya verildi" işaretlenmiş satırlar tamamen verilmiş sayılır
update public.sales set shipped_quantity = quantity where shipped_at is not null and shipped_quantity = 0;
