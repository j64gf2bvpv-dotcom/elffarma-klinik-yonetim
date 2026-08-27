-- "Tüm Hareketleri Sil" (delete_all_stock_movements_for_product RPC) kendi
-- audit_logs kaydını action='delete_all_stock_movements' ile yazmaya
-- çalışıyor, ama audit_logs_action_check kısıtı sadece 'insert'/'update'/
-- 'delete'/'rpc' değerlerine izin veriyordu (bkz. 20260811234522_remote_schema.sql) —
-- bu yüzden buton her tıklandığında "new row for relation audit_logs violates
-- check constraint audit_logs_action_check" hatasıyla başarısız oluyordu.
-- Kısıt, bu RPC'nin yazdığı değeri de kapsayacak şekilde genişletiliyor.
alter table public.audit_logs
  drop constraint audit_logs_action_check;

alter table public.audit_logs
  add constraint audit_logs_action_check
  check (action = any (array['insert'::text, 'update'::text, 'delete'::text, 'rpc'::text, 'delete_all_stock_movements'::text]));
