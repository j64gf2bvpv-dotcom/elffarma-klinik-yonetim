-- Kongrede hocalara verilen ürünler (kullanıcı isteği, 2026-11-27: "Mısır kongresi için hocalara verdiğimiz ürünlerin
-- listesi var Excel olarak, bunu programa ayrı bir sütuna işler misin"; "sadece kayıt tutulsun, stoktan düş tuşu da
-- olsun sonradan düşebilelim"). Satış / prim hesabına giren congress_participant_products'tan bilerek ayrı.
-- Excel düzeni: No | Tarih | Açıklama (ör. KAYIT KONAKLAMA ULAŞIM) | Adı Soyadı | Ürünler | Sipariş | Teslim Edilen | Borç Ürün | Not.
-- Kayıt stoğu değiştirmez; "Stoktan düş" teslim edilen adetten henüz düşülmemiş kısmı stok hareketi olarak düşer
-- (stock_deducted_quantity bunu tutar, aynı ürün iki kez düşülmez).
create table if not exists public.congress_given_products (
  id uuid primary key default gen_random_uuid(),
  congress_name text not null,
  group_no integer,
  given_date date,
  description text,
  doctor_name text not null,
  customer_id uuid references public.customers (id) on delete set null,
  product_name text not null,
  product_id uuid references public.products (id) on delete set null,
  ordered_quantity integer not null default 0,
  delivered_quantity integer not null default 0,
  owed_quantity integer not null default 0,
  note text,
  stock_deducted_quantity integer not null default 0,
  stock_deducted_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references public.staff (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists congress_given_products_congress_idx on public.congress_given_products (congress_name, sort_order);

drop trigger if exists set_updated_at on public.congress_given_products;
create trigger set_updated_at before update on public.congress_given_products
for each row execute function public.set_updated_at();

alter table public.congress_given_products enable row level security;

drop policy if exists "congress_given_products_all_staff" on public.congress_given_products;
create policy "congress_given_products_all_staff" on public.congress_given_products for all
  using (public.is_active_staff()) with check (public.is_active_staff());

grant all on public.congress_given_products to authenticated;
