-- Doktorlara (customers) Şahıs/Hastane tipi, il ve hastane adı ekler.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.customers
  add column if not exists doctor_type text not null default 'sahis';

alter table public.customers
  drop constraint if exists customers_doctor_type_check;
alter table public.customers
  add constraint customers_doctor_type_check check (doctor_type in ('sahis', 'hastane'));

alter table public.customers
  add column if not exists province text;

alter table public.customers
  add column if not exists hospital_name text;

comment on column public.customers.doctor_type is 'sahis: şahıs doktor, hastane: hastane bünyesinde çalışan doktor';
comment on column public.customers.province is 'Doktorun bulunduğu il';
comment on column public.customers.hospital_name is 'doctor_type = hastane ise bağlı olduğu hastane adı';
