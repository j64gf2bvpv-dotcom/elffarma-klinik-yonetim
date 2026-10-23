-- Personel ehliyetleri (kullanıcı isteği, 2026-10-23: "ehliyet kısmı da olsun,
-- personellerin ehliyet resimlerini ekleyebilelim, ön arka yüz şeklinde").
-- Araçlar sayfasında listelenir. Fotoğraflar private 'documents' bucket'ında
-- (personnel/ehliyet/...) — kişisel veri, imzalı URL / indirme ile açılır.
-- Ortak güven modeli: tüm aktif personel okur/yazar.

create table if not exists public.driver_licenses (
  id uuid primary key default gen_random_uuid(),
  person_name text not null,
  front_image_path text,
  back_image_path text,
  license_class text,          -- ehliyet sınıfı (B, C …) — opsiyonel
  valid_until date,            -- geçerlilik tarihi — opsiyonel
  notes text,
  created_by uuid default auth.uid() references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_licenses enable row level security;

drop policy if exists driver_licenses_all_staff on public.driver_licenses;
create policy driver_licenses_all_staff on public.driver_licenses
  for all using (public.is_active_staff()) with check (public.is_active_staff());

grant select, insert, update, delete on public.driver_licenses to authenticated;
