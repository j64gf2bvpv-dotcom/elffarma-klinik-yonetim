-- Kongrelere opsiyonel "Tek Kişi Katılım" ve "2 Kişi Katılım" paket fiyatları ekler.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.congresses
  add column if not exists single_person_price numeric(10, 2);

alter table public.congresses
  add column if not exists two_person_price numeric(10, 2);

comment on column public.congresses.single_person_price is 'Opsiyonel: tek kişi katılım paket fiyatı';
comment on column public.congresses.two_person_price is 'Opsiyonel: 2 kişi katılım paket fiyatı';
