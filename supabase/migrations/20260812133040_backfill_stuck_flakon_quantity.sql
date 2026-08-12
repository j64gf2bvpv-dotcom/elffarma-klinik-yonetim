-- Bugün eklenen seed_flakon_quantity_on_ratio_set tetikleyicisi sadece
-- flakon_per_package null'DAN bir değere geçerken çalışıyor. Bu tetikleyici
-- eklenmeden ÖNCE zaten bir oran girilmiş ürünler (bu özelliğin ilk test
-- edildiği bugünkü oturumda olduğu gibi) flakon_quantity=0'da kalıcı olarak
-- takılı kaldı — tekrar kaydetmek de tetiklemiyor çünkü old.flakon_per_package
-- artık null değil. Bu, o ürünler için TEK SEFERLİK bir telafi (catch-up)
-- güncellemesi: oranı tanımlı, flakon_quantity'si hâlâ 0 olan ürünlerde
-- flakon_quantity'yi mevcut paket adedine göre hesaplar.
update public.products
set flakon_quantity = current_quantity * flakon_per_package,
    updated_at = now()
where flakon_per_package is not null
  and flakon_quantity = 0
  and current_quantity > 0;
