-- Bu oturumla PARALEL çalışan başka bir Claude Code oturumu, aynı stok
-- modülü sertleştirme görevini kendi (ayrı) yerel checkout'undan bağımsız
-- olarak yürütmüş ve GitHub'a push etmiş; ikisi de AYNI canlı Supabase
-- projesine `db push` yaptığı için canlı şemada iki paralel katman birikti.
-- Bu migration, git geçmişi origin/main ile (fast-forward) birleştirildikten
-- SONRA, iki katman arasındaki somut çakışmaları TEK BİR yerde uzlaştırıyor:
--
-- 1) stock_count_items'ta flakon sayım alanları İKİ FARKLI isimle iki kez
--    eklenmişti: bu oturumun `expected_flakon_quantity`/`counted_flakon_quantity`'si
--    ve diğer oturumun `expected_quantity_flakon`/`counted_quantity_flakon`'ı.
--    Güncel (merge sonrası) uygulama kodu SADECE ikinci isimlendirmeyi
--    kullanıyor. Canlıda her iki sütun çiftinde de gerçek personel verisi
--    vardı (aynı satırda ikisi birden dolu değildi) — önce eskiden yeniye
--    kopyalanıp (veri kaybı olmadan) sonra eski/kullanılmayan sütunlar
--    kaldırılıyor.
-- 2) delete_stock_movement hâlâ diğer oturumun greatest(0,...) ile sessizce
--    sıfıra kırpan sürümündeydi — record_stock_movement/update_stock_movement
--    için zaten benimsenmiş "kırpma yok, negatif sonuç üretecek silme
--    reddedilsin" kuralına eşitleniyor.
-- 3) Bu oturumun canlıda zaten uygulanmış ama HİÇBİR migration dosyasında
--    kayıtlı olmayan ek sertleştirmeleri (stock_movements RLS kilidi,
--    negatif olamaz CHECK'leri, stock_counts.count_date UNIQUE, atomic
--    start/complete/reopen_stock_count + reset_all_stock RPC'leri) migration
--    geçmişine kaydediliyor — fonksiyonel bir değişiklik değil, gelecekteki
--    `db push`/`db reset` çalıştırmalarının bunları yanlışlıkla geri
--    almaması için. start_stock_count/complete_stock_count, artık kaldırılan
--    eski sütun isimleri yerine güncel `expected_quantity_flakon`/
--    `counted_quantity_flakon` isimlerini kullanacak şekilde güncellendi.

-- === 1) stock_count_items sütun birleştirme ===
update public.stock_count_items
set counted_quantity_flakon = coalesce(counted_quantity_flakon, counted_flakon_quantity)
where counted_quantity_flakon is null and counted_flakon_quantity is not null;

update public.stock_count_items
set expected_quantity_flakon = expected_flakon_quantity
where expected_quantity_flakon = 0 and expected_flakon_quantity <> 0;

alter table public.stock_count_items drop column if exists expected_flakon_quantity;
alter table public.stock_count_items drop column if exists counted_flakon_quantity;

-- === 2) delete_stock_movement: kırpma yok, unit_kind-farkında (imza aynı) ===
create or replace function public.delete_stock_movement(p_movement_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.stock_movements;
  v_delta integer;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  select * into v_row from public.stock_movements where id = p_movement_id;
  if not found then
    raise exception 'Hareket bulunamadı';
  end if;

  if v_row.source_type is distinct from 'manual' and not public.is_admin() then
    raise exception '% kaynaklı bir hareket — sadece yönetici silebilir', v_row.source_type;
  end if;

  v_delta := public.stock_movement_delta(v_row.movement_type, v_row.quantity);

  begin
    if v_row.unit_kind = 'flakon' then
      update public.products
      set flakon_quantity = flakon_quantity - v_delta,
          updated_at = now()
      where id = v_row.product_id;
    else
      update public.products
      set current_quantity = current_quantity - v_delta,
          updated_at = now()
      where id = v_row.product_id;

      if v_row.lot_id is not null then
        update public.product_lots
        set quantity = quantity - v_delta,
            updated_at = now()
        where id = v_row.lot_id;
      end if;
    end if;
  exception when check_violation then
    raise exception 'Bu hareket silinemez: geri alınması stoğu negatife düşürür (muhtemelen bu üründen daha sonra başka bir çıkış yapıldı)';
  end;

  delete from public.stock_movements where id = p_movement_id;
end;
$$;

-- === 3) Zaten canlı olan ek sertleştirmeleri migration geçmişine kaydet ===

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'product_lots_quantity_check' and conrelid = 'public.product_lots'::regclass
  ) then
    alter table public.product_lots add constraint product_lots_quantity_check check (quantity >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_current_quantity_check' and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint products_current_quantity_check check (current_quantity >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_flakon_quantity_check' and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint products_flakon_quantity_check check (flakon_quantity >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_counts_count_date_key' and conrelid = 'public.stock_counts'::regclass
  ) then
    alter table public.stock_counts add constraint stock_counts_count_date_key unique (count_date);
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'stock_movements' and policyname = 'stock_movements_all_staff') then
    drop policy stock_movements_all_staff on public.stock_movements;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'stock_movements' and policyname = 'stock_movements_select_staff') then
    create policy stock_movements_select_staff on public.stock_movements
      for select using (public.is_active_staff());
  end if;
end $$;

create or replace function public.start_stock_count(p_count_date date default current_date, p_notes text default null)
returns public.stock_counts
language plpgsql
security definer set search_path = public
as $$
declare
  v_count public.stock_counts;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  if exists (select 1 from public.stock_counts where count_date = p_count_date) then
    raise exception 'Bu tarih için zaten bir sayım açılmış (%)', to_char(p_count_date, 'DD.MM.YYYY');
  end if;

  insert into public.stock_counts (count_date, notes, created_by)
  values (p_count_date, p_notes, auth.uid())
  returning * into v_count;

  insert into public.stock_count_items (stock_count_id, product_id, expected_quantity, expected_quantity_flakon)
  select v_count.id, id, current_quantity, flakon_quantity
  from public.products
  where is_active = true;

  return v_count;
end;
$$;

create or replace function public.complete_stock_count(p_stock_count_id uuid)
returns public.stock_counts
language plpgsql
security definer set search_path = public
as $$
declare
  v_count public.stock_counts;
  v_item record;
  v_diff integer;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  select * into v_count from public.stock_counts where id = p_stock_count_id for update;
  if not found then
    raise exception 'Sayım bulunamadı';
  end if;
  if v_count.status = 'completed' then
    raise exception 'Bu sayım zaten tamamlanmış';
  end if;

  for v_item in
    select * from public.stock_count_items where stock_count_id = p_stock_count_id
  loop
    if v_item.counted_quantity is not null then
      v_diff := v_item.counted_quantity - v_item.expected_quantity;
      if v_diff <> 0 then
        perform public.record_stock_movement(
          p_product_id := v_item.product_id,
          p_movement_type := case when v_diff > 0 then 'in' else 'out' end,
          p_quantity := abs(v_diff),
          p_reason := 'Sayım mutabakatı',
          p_unit_kind := 'paket',
          p_source_type := 'count',
          p_source_id := p_stock_count_id
        );
      end if;
    end if;

    if v_item.counted_quantity_flakon is not null then
      v_diff := v_item.counted_quantity_flakon - v_item.expected_quantity_flakon;
      if v_diff <> 0 then
        perform public.record_stock_movement(
          p_product_id := v_item.product_id,
          p_movement_type := case when v_diff > 0 then 'in' else 'out' end,
          p_quantity := abs(v_diff),
          p_reason := 'Sayım mutabakatı (flakon)',
          p_unit_kind := 'flakon',
          p_source_type := 'count',
          p_source_id := p_stock_count_id
        );
      end if;
    end if;
  end loop;

  update public.stock_counts
  set status = 'completed', completed_at = now()
  where id = p_stock_count_id
  returning * into v_count;

  return v_count;
end;
$$;

create or replace function public.reopen_stock_count(p_stock_count_id uuid)
returns public.stock_counts
language plpgsql
security definer set search_path = public
as $$
declare
  v_count public.stock_counts;
  v_movement_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Sadece yönetici bir sayımı yeniden açabilir';
  end if;

  select * into v_count from public.stock_counts where id = p_stock_count_id for update;
  if not found then
    raise exception 'Sayım bulunamadı';
  end if;
  if v_count.status <> 'completed' then
    raise exception 'Sadece tamamlanmış bir sayım yeniden açılabilir';
  end if;

  for v_movement_id in
    select id from public.stock_movements
    where source_type = 'count' and source_id = p_stock_count_id
  loop
    perform public.delete_stock_movement(v_movement_id);
  end loop;

  update public.stock_counts
  set status = 'open', completed_at = null
  where id = p_stock_count_id
  returning * into v_count;

  return v_count;
end;
$$;

create or replace function public.reset_all_stock(p_reason text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_product record;
  v_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Sadece yönetici tüm stoğu sıfırlayabilir';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Sıfırlama gerekçesi zorunludur';
  end if;

  for v_product in
    select id, current_quantity, flakon_quantity from public.products
    where is_active = true and (current_quantity > 0 or flakon_quantity > 0)
  loop
    if v_product.current_quantity > 0 then
      perform public.record_stock_movement(
        p_product_id := v_product.id,
        p_movement_type := 'out',
        p_quantity := v_product.current_quantity,
        p_reason := p_reason,
        p_unit_kind := 'paket',
        p_source_type := 'reset'
      );
    end if;
    if v_product.flakon_quantity > 0 then
      perform public.record_stock_movement(
        p_product_id := v_product.id,
        p_movement_type := 'out',
        p_quantity := v_product.flakon_quantity,
        p_reason := p_reason,
        p_unit_kind := 'flakon',
        p_source_type := 'reset'
      );
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant all on function public.start_stock_count(date, text) to anon, authenticated, service_role;
grant all on function public.complete_stock_count(uuid) to anon, authenticated, service_role;
grant all on function public.reopen_stock_count(uuid) to anon, authenticated, service_role;
grant all on function public.reset_all_stock(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
