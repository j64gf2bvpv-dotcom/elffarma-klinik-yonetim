-- Personel artık ürün adını ve kategorisini düzenleyebilsin (kullanıcı isteğiyle,
-- 2026-08-21) — diğer tüm ürün alanları (fiyat, stok miktarı, barkod, kategori
-- dışındaki her şey) admin-only kalmaya devam ediyor. Sadece RLS'i personele
-- açmak yetmez (o zaman herhangi bir sütunu değiştirebilirler) — bu yüzden
-- UPDATE politikası is_active_staff()'a gevşetiliyor AMA satır bazlı bir
-- BEFORE UPDATE tetikleyicisi, admin olmayanlar için name/category dışındaki
-- herhangi bir sütun değiştiğinde işlemi reddediyor. to_jsonb farkı kullanmak
-- (tek tek sütun listelemek yerine) ileride tabloya eklenecek yeni sütunların
-- da otomatik olarak korumaya dahil olmasını sağlıyor.

drop policy if exists "products_update_admin" on public.products;
create policy "products_update_admin" on public.products for update
  using (public.is_active_staff())
  with check (public.is_active_staff());

create or replace function public.enforce_products_staff_editable_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if (to_jsonb(new) - 'name' - 'category' - 'updated_at')
       is distinct from
       (to_jsonb(old) - 'name' - 'category' - 'updated_at') then
      raise exception 'Bu alanı düzenleme yetkiniz yok — personel sadece ürün adını ve kategorisini değiştirebilir.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_staff_editable_columns_guard on public.products;
create trigger products_staff_editable_columns_guard
  before update on public.products
  for each row
  execute function public.enforce_products_staff_editable_columns();
