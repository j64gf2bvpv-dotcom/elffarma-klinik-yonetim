-- Kullanıcı isteği: Stok Yönetimi'nde bir Kargo bölümü — hoca (doktor) adı/
-- telefon/adres/not, gönderilecek ürün ve miktarı, durumu (bekletiliyor /
-- gönderilecek / gönderildi) ve gönderim tarihini tutan, stokla bağlantılı
-- çalışan bir panel. Diğer iş verisi tablolarıyla aynı paylaşımlı güven
-- modeli (herhangi bir aktif personel okuyup yazabilir).
create table public.cargo_shipments (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references public.customers(id) on delete set null,
  recipient_name text not null,
  phone          text,
  address        text,
  product_id     uuid references public.products(id) on delete set null,
  product_name   text not null,
  quantity       integer not null check (quantity > 0),
  status         text not null default 'bekletiliyor'
                   check (status in ('bekletiliyor', 'gonderilecek', 'gonderildi')),
  ship_date      date,
  note           text,
  reminder_id    uuid references public.reminders(id) on delete set null,
  created_by     uuid references public.staff(id),
  shipped_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.cargo_shipments enable row level security;

create policy cargo_shipments_all_staff on public.cargo_shipments
  for all
  using (is_active_staff())
  with check (is_active_staff());

create trigger cargo_shipments_set_updated_at
  before update on public.cargo_shipments
  for each row execute function public.set_updated_at();

grant all on public.cargo_shipments to authenticated;
grant all on public.cargo_shipments to service_role;

notify pgrst, 'reload schema';
