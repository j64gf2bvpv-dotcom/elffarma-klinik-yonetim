-- Ayarlar tüm kullanıcılara açılırken fark edildi: açık/koyu mod
-- (color_mode) o zamana kadar app_settings'te (admin-write/staff-read)
-- saklanıyordu — yani TopBar'daki güneş/ay düğmesine hangi kullanıcı basarsa
-- bassın, admin olmayan biri için RLS sessizce reddediyordu (UI hiçbir hata
-- göstermeden tıklama etkisiz kalıyordu). Açık/koyu mod kişisel bir tercih
-- olduğu için staff_preferences'a (sahibi kendi satırını okur/yazar) taşındı.
alter table public.staff_preferences
  add column if not exists color_mode text check (color_mode in ('light', 'dark'));

notify pgrst, 'reload schema';
