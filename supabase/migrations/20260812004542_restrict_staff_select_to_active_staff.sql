-- staff_select: pasife alınmış bir personelin (auth oturumu hâlâ geçerli
-- olsa bile) personel listesini okumaya devam etmesini engeller.
--
-- Önce ilişkiyi doğruladım: `public.is_active_staff()` SECURITY DEFINER
-- olarak tanımlı (bkz. supabase/schema.sql, "Yardımcı fonksiyon" bölümü) —
-- fonksiyon çağrıldığında sahibinin yetkisiyle çalışıp `public.staff`
-- tablosunu kendi RLS'inden bağımsız okuyor, bu yüzden aynı tablonun kendi
-- SELECT policy'si içinde çağrılması döngüsel bir RLS sorununa yol açmıyor
-- (diğer 52 tablonun policy'lerinde zaten aynı desen kullanılıyor).
--
-- Önceki durum: using (auth.uid() is not null) — sadece geçerli bir oturum
-- yeterliydi, is_active durumuna bakılmıyordu.
--
-- `staff_update_admin` / `staff_update_self` politikalarına ve
-- `protect_staff_privileged_columns` trigger'ına dokunulmadı; sadece SELECT
-- politikası değişiyor.
drop policy if exists "staff_select" on public.staff;
create policy "staff_select" on public.staff for select
  using (public.is_active_staff());
