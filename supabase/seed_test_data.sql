-- ÖRNEK/TEST VERİSİ — mobil uygulamadaki her menüyü gerçek veriyle test
-- edebilmeniz için hazırlandı. Bütün kayıtlar "[TEST]" önekiyle işaretli,
-- böylece gerçek verilerinizle karışmaz ve aşağıdaki DELETE bloğuyla
-- (dosyanın en altında) tek seferde temizce geri alınabilir.
--
-- Kullanım: Supabase Dashboard > SQL Editor'a yapıştırıp çalıştırın.
-- İlk admin hesabınızın id'sini otomatik bulur (aşağıdaki subquery'ler),
-- elle bir id girmenize gerek yok.

-- =========================================================
-- 1. Bölge + Satış Temsilcisi (Doktorlar > Bölgesel filtre, Hedeflerim,
--    Haftalık Rapor/Plan'ın isim-eşleştirmesi için)
-- =========================================================
insert into public.regions (name)
select '[TEST] İstanbul'
where not exists (select 1 from public.regions where name = '[TEST] İstanbul');

insert into public.regions (name, parent_region_id)
select '[TEST] Kadıköy', (select id from public.regions where name = '[TEST] İstanbul')
where not exists (select 1 from public.regions where name = '[TEST] Kadıköy');

-- Satış temsilcisi adı, ilk admin personelinizin adıyla AYNI yapılıyor —
-- böylece "Benim Doktorlarım" / "Hedeflerim" / Haftalık Rapor'daki isim
-- eşleştirmesi (staff.full_name ↔ sales_reps.name) test hesabınızla da
-- çalışır. Zaten eşleşen bir kayıt varsa tekrar eklenmez.
insert into public.sales_reps (name, sales_target)
select s.full_name, 50000
from public.staff s
where s.role = 'admin'
  and not exists (select 1 from public.sales_reps r where r.name = s.full_name)
limit 1;

-- =========================================================
-- 2. Örnek Doktorlar (Doktorlar listesi, Harita — enlem/boylam dolu,
--    Belgeler/Notlar/Ürün Ver test edilebilsin diye)
-- =========================================================
insert into public.customers (full_name, phone, email, specialty, hospital_name, province, district, region_id, sales_rep_id, is_active, latitude, longitude, notes)
select '[TEST] Dr. Ayşe Yılmaz', '05551112233', 'ayse.test@example.com', 'Dermatoloji', 'Acıbadem Kadıköy', 'İstanbul', 'Kadıköy',
  (select id from public.regions where name = '[TEST] Kadıköy'),
  (select id from public.sales_reps where name = (select full_name from public.staff where role = 'admin' limit 1)),
  true, 40.9830, 29.0270, '[TEST] Örnek doktor kaydı — silinebilir.'
where not exists (select 1 from public.customers where full_name = '[TEST] Dr. Ayşe Yılmaz');

insert into public.customers (full_name, phone, email, specialty, hospital_name, province, district, region_id, is_active, latitude, longitude)
select '[TEST] Dr. Mehmet Kaya', '05552223344', 'mehmet.test@example.com', 'Plastik Cerrahi', 'Memorial Şişli', 'İstanbul', 'Şişli',
  (select id from public.regions where name = '[TEST] İstanbul'),
  true, 41.0602, 28.9877
where not exists (select 1 from public.customers where full_name = '[TEST] Dr. Mehmet Kaya');

-- =========================================================
-- 3. Örnek Ürünler (Stok ekranı, kritik stok testi için biri düşük stoklu)
-- =========================================================
insert into public.products (name, category, unit, critical_stock_threshold, current_quantity, unit_price, brand_line)
select '[TEST] Fillicia 200', 'Dolgu', 'adet', 10, 3, 1200, 'dermakor'
where not exists (select 1 from public.products where name = '[TEST] Fillicia 200');

insert into public.products (name, category, unit, critical_stock_threshold, current_quantity, unit_price, brand_line)
select '[TEST] Botox 100U', 'Botoks', 'adet', 5, 40, 2500, 'swiss'
where not exists (select 1 from public.products where name = '[TEST] Botox 100U');

-- =========================================================
-- 4. Örnek Doktor Ziyareti (tamamlanmış, notlarla — Ziyaret Geçmişi detay
--    modalını test etmek için)
-- =========================================================
insert into public.doctor_visits (visit_date, doctor_name, customer_id, sales_rep_id, check_in_at, check_out_at, notes, discussed_products, next_visit_date)
select current_date, '[TEST] Dr. Ayşe Yılmaz',
  (select id from public.customers where full_name = '[TEST] Dr. Ayşe Yılmaz'),
  (select id from public.sales_reps where name = (select full_name from public.staff where role = 'admin' limit 1)),
  now() - interval '1 hour', now() - interval '30 minutes',
  '[TEST] Fillicia 200 numunesi tanıtıldı, doktor memnun kaldı.',
  'Fillicia 200, Botox 100U',
  current_date + 14
where not exists (
  select 1 from public.doctor_visits
  where doctor_name = '[TEST] Dr. Ayşe Yılmaz' and visit_date = current_date
);

-- Bu ziyarette verilen numune — Stok Hareketi (record_stock_movement RPC'sini
-- atlayıp doğrudan tabloya yazıyoruz çünkü RPC auth.uid() ister; SQL Editor'da
-- konsol kullanıcısı olarak çalıştığınız için current_quantity'yi de manuel
-- senkron tutuyoruz.)
insert into public.stock_movements (product_id, movement_type, quantity, customer_id, note)
select
  (select id from public.products where name = '[TEST] Fillicia 200'),
  'sample', 1,
  (select id from public.customers where full_name = '[TEST] Dr. Ayşe Yılmaz'),
  '[TEST] Ziyarette verildi'
where not exists (
  select 1 from public.stock_movements
  where note = '[TEST] Ziyarette verildi'
);
update public.products set current_quantity = greatest(0, current_quantity - 1)
where name = '[TEST] Fillicia 200'
  and exists (select 1 from public.stock_movements where note = '[TEST] Ziyarette verildi');

-- =========================================================
-- 5. Örnek Görev + Hatırlatma (Görevler, Ajanda/Hatırlatmalar)
-- =========================================================
insert into public.tasks (title, description, due_date, assigned_to, customer_id, priority)
select '[TEST] Dr. Ayşe Yılmaz''ı ara', 'Numune geri bildirimini al', current_date + 2,
  (select id from public.staff where role = 'admin' limit 1),
  (select id from public.customers where full_name = '[TEST] Dr. Ayşe Yılmaz'),
  'yuksek'
where not exists (select 1 from public.tasks where title = '[TEST] Dr. Ayşe Yılmaz''ı ara');

insert into public.reminders (title, note, due_date)
select '[TEST] Kongre kayıt son tarihi', 'Ekam Kongresi kayıtları bu tarihte kapanıyor', current_date + 5
where not exists (select 1 from public.reminders where title = '[TEST] Kongre kayıt son tarihi');

-- =========================================================
-- 6. Örnek Fırsat + Teklif (Fırsatlar, Teklifler)
-- =========================================================
insert into public.crm_opportunities (customer_id, title, stage, amount, expected_close_date)
select (select id from public.customers where full_name = '[TEST] Dr. Mehmet Kaya'),
  '[TEST] Botoks paket teklifi', 'teklif', 15000, current_date + 10
where not exists (select 1 from public.crm_opportunities where title = '[TEST] Botoks paket teklifi');

insert into public.quotes (quote_number, customer_id, status, valid_until, discount_rate, vat_rate)
select '[TEST]-TKL-0001', (select id from public.customers where full_name = '[TEST] Dr. Mehmet Kaya'),
  'taslak', current_date + 15, 10, 20
where not exists (select 1 from public.quotes where quote_number = '[TEST]-TKL-0001');

insert into public.quote_items (quote_id, product_id, product_name, quantity, unit_price)
select (select id from public.quotes where quote_number = '[TEST]-TKL-0001'),
  (select id from public.products where name = '[TEST] Botox 100U'),
  '[TEST] Botox 100U', 5, 2500
where exists (select 1 from public.quotes where quote_number = '[TEST]-TKL-0001')
  and not exists (
    select 1 from public.quote_items
    where quote_id = (select id from public.quotes where quote_number = '[TEST]-TKL-0001')
  );

-- =========================================================
-- 7. Örnek Kongre + Katılımcı (Kongreler)
-- =========================================================
insert into public.congresses (name, start_date, end_date, city, venue, will_attend)
select '[TEST] Örnek Estetik Kongresi', current_date + 20, current_date + 22, 'Antalya', 'Rixos Kongre Merkezi', true
where not exists (select 1 from public.congresses where name = '[TEST] Örnek Estetik Kongresi');

insert into public.congress_participants (congress_id, doctor_name, attendance_status)
select (select id from public.congresses where name = '[TEST] Örnek Estetik Kongresi'), '[TEST] Dr. Ayşe Yılmaz', 'registered'
where exists (select 1 from public.congresses where name = '[TEST] Örnek Estetik Kongresi')
  and not exists (
    select 1 from public.congress_participants
    where congress_id = (select id from public.congresses where name = '[TEST] Örnek Estetik Kongresi')
  );

-- =========================================================
-- 8. Örnek Haftalık Plan (admin doktor atar — Haftalık Plan ekranı)
-- =========================================================
insert into public.visit_plans (customer_id, assigned_staff_id, planned_date, note, created_by)
select (select id from public.customers where full_name = '[TEST] Dr. Mehmet Kaya'),
  (select id from public.staff where role = 'admin' limit 1),
  current_date + 1,
  '[TEST] Teklif takibi için ziyaret',
  (select id from public.staff where role = 'admin' limit 1)
where not exists (
  select 1 from public.visit_plans where note = '[TEST] Teklif takibi için ziyaret'
);

-- =========================================================
-- 9. Örnek Ekip Sohbeti Mesajı (Ekip Sohbeti)
-- =========================================================
insert into public.staff_messages (sender_id, body)
select (select id from public.staff where role = 'admin' limit 1),
  '[TEST] Merhaba ekip, bu bir örnek mesajdır — Ekip Sohbeti ekranını test etmek için eklendi.'
where not exists (
  select 1 from public.staff_messages
  where body like '[TEST] Merhaba ekip%'
);

-- =========================================================
-- Kontrol: eklenen kayıt sayıları
-- =========================================================
select 'customers' as tablo, count(*) as adet from public.customers where full_name like '[TEST]%'
union all select 'products', count(*) from public.products where name like '[TEST]%'
union all select 'doctor_visits', count(*) from public.doctor_visits where doctor_name like '[TEST]%'
union all select 'tasks', count(*) from public.tasks where title like '[TEST]%'
union all select 'reminders', count(*) from public.reminders where title like '[TEST]%'
union all select 'crm_opportunities', count(*) from public.crm_opportunities where title like '[TEST]%'
union all select 'quotes', count(*) from public.quotes where quote_number like '[TEST]%'
union all select 'congresses', count(*) from public.congresses where name like '[TEST]%'
union all select 'visit_plans', count(*) from public.visit_plans where note like '[TEST]%'
union all select 'staff_messages', count(*) from public.staff_messages where body like '[TEST]%';

-- =========================================================
-- TEMİZLİK — test bittiğinde bu bloğu (yorum işaretlerini kaldırıp)
-- ayrıca çalıştırarak tüm [TEST] kayıtlarını tek seferde silebilirsiniz.
-- Sıralama FK bağımlılıklarına göredir (önce çocuk tablolar).
-- =========================================================
-- delete from public.staff_messages where body like '[TEST]%';
-- delete from public.visit_plans where note like '[TEST]%';
-- delete from public.congress_participants where doctor_name like '[TEST]%';
-- delete from public.congresses where name like '[TEST]%';
-- delete from public.quote_items where product_name like '[TEST]%';
-- delete from public.quotes where quote_number like '[TEST]%';
-- delete from public.crm_opportunities where title like '[TEST]%';
-- delete from public.reminders where title like '[TEST]%';
-- delete from public.tasks where title like '[TEST]%';
-- delete from public.stock_movements where note like '[TEST]%';
-- delete from public.doctor_visits where doctor_name like '[TEST]%';
-- delete from public.products where name like '[TEST]%';
-- delete from public.customers where full_name like '[TEST]%';
-- delete from public.regions where name like '[TEST]%';
--
-- NOT: sales_reps kaydını kasıtlı olarak silme listesine almadım — bölüm 1'de
-- bu kayıt admin hesabınızın adıyla AYNI isimle oluşturuldu (isim eşleştirmesi
-- test edilebilsin diye). Eğer daha önce zaten böyle bir temsilci kaydınız
-- vardı, script onu yeniden kullanmıştır (yeni satır eklenmez) — bu durumda
-- SİLMEYİN. Yeni oluşturulduysa ve silmek isterseniz:
-- delete from public.sales_reps where name = (select full_name from public.staff where role = 'admin' limit 1);
