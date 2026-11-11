-- Faturalar: fatura dönemi (ör. 2026-06) — faturadan okunur, tabloda ve çıktılarda görünür
-- (kullanıcı isteği, 2026-11-11: "eklediğim faturada dönem tarihi ve tutarı da yazsın").
alter table public.utility_bills add column if not exists period text;
comment on column public.utility_bills.period is 'Fatura dönemi, YYYY-MM';
