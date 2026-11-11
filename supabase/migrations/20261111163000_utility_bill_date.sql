-- Faturalar: faturanın üzerindeki fatura tarihi — tabloda ve çıktılarda son ödeme tarihi
-- yerine bu görünür (kullanıcı isteği, 2026-11-11: "son ödeme tarihi olmasın, fotoğraftaki
-- tarih yazsın"). due_date hatırlatmalar ve her ay tekrarlama için olduğu gibi kalır.
alter table public.utility_bills add column if not exists bill_date date;
comment on column public.utility_bills.bill_date is 'Faturanın üzerindeki fatura tarihi';
