-- Stok > Doktor Hesapları: tablo hücrelerine elle girilen değerler
-- (kullanıcı isteği, 2026-10-21: "aldığı, alacağı, toplam tutar bunların da
-- üstüne tıklanınca manuel düzenlenebilsin"). Değer NULL ise uygulama satış /
-- eksik ürün / tahsilat kayıtlarından otomatik hesaplar; doluysa bu değer
-- gösterilir. Gerçek kayıtlara (satış, tahsilat) ve Cari Hesap'a dokunmaz.
-- Ortak güven modeli: tüm aktif personel okur/yazar.

create table if not exists public.doctor_account_overrides (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  bought_qty integer check (bought_qty is null or bought_qty >= 0),
  pending_qty integer check (pending_qty is null or pending_qty >= 0),
  total_amount numeric(14, 2) check (total_amount is null or total_amount >= 0),
  paid_amount numeric(14, 2) check (paid_amount is null or paid_amount >= 0),
  updated_by uuid default auth.uid() references public.staff(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.doctor_account_overrides enable row level security;

drop policy if exists doctor_account_overrides_all_staff on public.doctor_account_overrides;
create policy doctor_account_overrides_all_staff on public.doctor_account_overrides
  for all using (public.is_active_staff()) with check (public.is_active_staff());

grant select, insert, update, delete on public.doctor_account_overrides to authenticated;
