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
-- Kongrelere opsiyonel "Tek Kişi Katılım" ve "2 Kişi Katılım" paket fiyatları ekler.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.congresses
  add column if not exists single_person_price numeric(10, 2);

alter table public.congresses
  add column if not exists two_person_price numeric(10, 2);

comment on column public.congresses.single_person_price is 'Opsiyonel: tek kişi katılım paket fiyatı';
comment on column public.congresses.two_person_price is 'Opsiyonel: 2 kişi katılım paket fiyatı';
-- Tahsilata hangi satış temsilcisinin sattığını ekler.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.payments
  add column if not exists sales_rep_id uuid references public.sales_reps (id);

comment on column public.payments.sales_rep_id is 'Bu tahsilatı/satışı yapan satış temsilcisi';
-- Kongrede bir doktora satılan ürüne hangi satış temsilcisinin sattığını ekler.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.congress_participant_products
  add column if not exists sales_rep_id uuid references public.sales_reps (id);

comment on column public.congress_participant_products.sales_rep_id is 'Bu ürünü doktora satan satış temsilcisi';
-- Doktorlara opsiyonel "ödeme vadesi" tarihi ekler (yaklaşan/gecikmiş ödemeleri işaretlemek için).
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.customers
  add column if not exists next_payment_due date;

comment on column public.customers.next_payment_due is 'Opsiyonel: doktorun bir sonraki ödeme vadesi tarihi';
