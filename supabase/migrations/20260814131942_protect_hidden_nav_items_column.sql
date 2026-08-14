-- staff_update_self RLS politikası (auth.uid() = id) kolon bazlı bir kısıtlama
-- yapmıyor — bir kullanıcı `updateMyProfile` gibi kendi satırını güncelleyen
-- HERHANGİ bir çağrıya `hidden_nav_items` de ekleyebilirdi, bu da admin'in
-- belirlediği panel görünürlüğünü kendi kendine değiştirebilmesi anlamına
-- gelirdi. protect_staff_privileged_columns tetikleyicisi role/is_active/
-- full_name'i zaten koruyordu — aynı korumaya hidden_nav_items de eklendi.
create or replace function public.protect_staff_privileged_columns()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
    new.full_name := old.full_name;
    new.hidden_nav_items := old.hidden_nav_items;
  end if;
  return new;
end;
$function$;

notify pgrst, 'reload schema';
