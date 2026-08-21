-- Kullanıcı isteğiyle (2026-08-21): Stok sekmesinde, Kargo'dan önce, kongre/
-- workshopa GÖTÜRÜLEN toplam ürün miktarı + geri dönen (kapalı/açık) miktarların
-- ayrıca girilebildiği, kongre BAŞINA toplu bir sevkiyat defteri.
--
-- BİLEREK congress_stock_items'tan AYRI bir tablo: o tablo halihazırda
-- CongressStockItemsPanel (Kongreler modülü) tarafından kullanılıyor ve
-- satır başına TEK bir durum (goturuldu/kullanildi/geri_dondu — ya tamamen
-- dışarıda ya tamamen geri dönmüş) modelliyor. Burada istenen farklı: aynı
-- satırda parçalı geri dönüş (kapalı X + açık Y + kalan kullanılan Z, hepsi
-- aynı anda) — congress_stock_items'a bu alanları eklemek, o tablonun zaten
-- çalışan durum-bazlı stok hareketi mantığıyla çakışıp iki farklı akışın aynı
-- satırda birbirinin hareketini ikiletmesi riski taşırdı. Ayrı tablo bu riski
-- baştan ortadan kaldırıyor.
--
-- Stok bağlantısı: quantity_taken girilince (satır oluşturulunca) 'out'
-- hareketi; quantity_returned_sealed/open ARTINCA (önceki değere göre delta)
-- 'return' hareketi — ikisi de gerçek stoğu değiştirir. "Kullanılan" ayrıca
-- saklanmıyor, quantity_taken - returned_sealed - returned_open olarak
-- İSTEMCİ TARAFINDA hesaplanıyor (kullanıcı tercihi: otomatik hesap).

create table public.congress_shipments (
  id uuid primary key default gen_random_uuid(),
  congress_id uuid not null references public.congresses (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  quantity_taken integer not null check (quantity_taken > 0),
  quantity_returned_sealed integer not null default 0 check (quantity_returned_sealed >= 0),
  quantity_returned_open integer not null default 0 check (quantity_returned_open >= 0),
  note text,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint congress_shipments_returned_not_exceed_taken
    check (quantity_returned_sealed + quantity_returned_open <= quantity_taken)
);

create index congress_shipments_congress_idx on public.congress_shipments (congress_id);
create index congress_shipments_product_idx on public.congress_shipments (product_id);

drop trigger if exists set_updated_at on public.congress_shipments;
create trigger set_updated_at before update on public.congress_shipments
for each row execute function public.set_updated_at();

alter table public.congress_shipments enable row level security;

drop policy if exists "congress_shipments_all_staff" on public.congress_shipments;
create policy "congress_shipments_all_staff" on public.congress_shipments for all
  using (public.is_active_staff()) with check (public.is_active_staff());
