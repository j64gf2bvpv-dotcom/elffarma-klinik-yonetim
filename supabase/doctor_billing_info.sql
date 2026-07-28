-- Doktora fatura/tahsilat bilgileri ekler: TC Kimlik No, Adres, Vergi Numarası, KDV Oranı,
-- Tercih Edilen Ödeme Şekli. (İleride gerçek BirFatura entegrasyonu kurulduğunda bu alanlar kullanılacak.)
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.customers
  add column if not exists tc_no text;

alter table public.customers
  add column if not exists address text;

alter table public.customers
  add column if not exists tax_number text;

alter table public.customers
  add column if not exists vat_rate numeric(5, 2);

alter table public.customers
  add column if not exists preferred_payment_method text;

alter table public.customers
  drop constraint if exists customers_preferred_payment_method_check;
alter table public.customers
  add constraint customers_preferred_payment_method_check
  check (preferred_payment_method is null or preferred_payment_method in ('nakit', 'kredi_karti', 'havale'));

comment on column public.customers.tc_no is 'Opsiyonel: doktorun TC Kimlik Numarası';
comment on column public.customers.address is 'Opsiyonel: doktorun/hastanenin fatura adresi';
comment on column public.customers.tax_number is 'Opsiyonel: vergi numarası';
comment on column public.customers.vat_rate is 'Opsiyonel: KDV oranı (%)';
comment on column public.customers.preferred_payment_method is 'Opsiyonel: tercih edilen ödeme şekli (nakit/kredi_karti/havale)';
