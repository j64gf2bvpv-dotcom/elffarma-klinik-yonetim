-- Kullanıcı isteği: admin, Ayarlar'dan hangi kullanıcının hangi panelleri
-- (sol menü sekmelerini) göreceğini belirleyebilsin; Ayarlar sayfası tüm
-- kullanıcılar için açık olsun; her kullanıcı kendi Ana Panel kartlarını
-- (widget düzeni) kişiselleştirebilsin.
--
-- hidden_nav_items: staff tablosuna eklendi (AppShell.tsx'teki NavKey
-- değerlerinden bir alt küme, örn. {'stock','crm'}) — staff tablosu zaten
-- "admin-write / staff-read" paylaşımlı güven modelinde (bkz. CLAUDE.md), bu
-- yüzden ayrı bir RLS politikasına gerek yok: mevcut staff RLS politikaları
-- bu yeni sütunu da otomatik kapsıyor (herkes okuyabilir — kendi menüsünü
-- filtrelemek için gerekli — sadece admin yazabilir).
alter table public.staff
  add column if not exists hidden_nav_items text[] not null default '{}';

-- staff_preferences: KİŞİSEL Ana Panel görünüm tercihi (view + widget
-- düzeni) — mevcut app_settings.dashboard_view/dashboard_layout TÜM ekibe
-- ortak tek bir düzen dayatıyordu (admin-write/staff-read paylaşımlı
-- tablo); kişiselleştirme için bu, staff_ai_keys ile AYNI "sahibi kendi
-- satırını okur/yazar" desenini kullanan YENİ, izole bir tablo olmalı —
-- staff tablosunun admin-write kısıtlamasına dokunmadan.
create table public.staff_preferences (
  staff_id        uuid primary key references public.staff(id) on delete cascade,
  dashboard_view  text check (dashboard_view in ('classic', 'widgets')),
  dashboard_layout jsonb,
  updated_at      timestamptz not null default now()
);

alter table public.staff_preferences enable row level security;

create policy staff_preferences_own_select on public.staff_preferences
  for select
  using (staff_id = auth.uid());

create policy staff_preferences_own_insert on public.staff_preferences
  for insert
  with check (staff_id = auth.uid());

create policy staff_preferences_own_update on public.staff_preferences
  for update
  using (staff_id = auth.uid())
  with check (staff_id = auth.uid());

create policy staff_preferences_own_delete on public.staff_preferences
  for delete
  using (staff_id = auth.uid());

grant all on public.staff_preferences to authenticated;
grant all on public.staff_preferences to service_role;

notify pgrst, 'reload schema';
