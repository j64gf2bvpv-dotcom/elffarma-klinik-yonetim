-- stock_movements.customer_id, customers tablosuna kademesiz (RESTRICT) bağlıydı;
-- bu yüzden herhangi bir stok hareketinde (satış/iade) adı geçen bir doktor
-- silinmek istendiğinde "foreign key constraint" hatası alınıyordu.
-- Stok hareket geçmişi (denetim kaydı) korunsun, sadece silinen doktora olan
-- referans boşa düşsün diye ON DELETE SET NULL olarak değiştiriyoruz.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.stock_movements
  drop constraint if exists stock_movements_customer_id_fkey;

alter table public.stock_movements
  add constraint stock_movements_customer_id_fkey
  foreign key (customer_id) references public.customers (id) on delete set null;
