-- Mobil "Daha Fazla" menüsü: admin, personel bazında hangi panellerin
-- gizleneceğini belirleyebilsin. Sıralama ise herkes için ortak/global
-- olduğundan (app_settings['mobile_more_menu_order'] key'i altında)
-- burada ayrı bir sütuna gerek yok.
alter table public.staff
  add column mobile_hidden_panels text[] not null default '{}';
