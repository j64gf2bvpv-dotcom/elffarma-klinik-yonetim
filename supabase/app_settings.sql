-- Admin tarafından düzenlenebilen genel uygulama ayarları
-- (panel düzeni/görünürlüğü, marka rengi vb.) için tek bir key-value tablo.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_staff" on public.app_settings;
create policy "app_settings_select_staff" on public.app_settings for select
  using (public.is_active_staff());

drop policy if exists "app_settings_insert_admin" on public.app_settings;
create policy "app_settings_insert_admin" on public.app_settings for insert
  with check (public.is_admin());

drop policy if exists "app_settings_update_admin" on public.app_settings;
create policy "app_settings_update_admin" on public.app_settings for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "app_settings_delete_admin" on public.app_settings;
create policy "app_settings_delete_admin" on public.app_settings for delete
  using (public.is_admin());
