-- Kullanıcı isteğiyle (2026-08-17): "Tümü" sekmesi gerçekten her ürünü
-- göstersin, ürün hattı (Dermakor/Swiss) artık sabit 2 değerle sınırlı
-- olmasın — admin yeni katalog/marka ekleyebilsin. products.brand_line
-- (text) hiçbir yerde tipini/değerini değiştirmiyor (importProducts.ts'in
-- regex tahmini, komisyon kurallarındaki scope_value eşleşmesi gibi
-- mevcut 10'dan fazla çağıran kod hiç dokunulmadan çalışmaya devam ediyor)
-- — sadece hangi değerlerin GEÇERLİ olduğunu admin'in yönetebildiği yeni
-- bir referans tablosuna bağlanıyor (doğal anahtar: name, surrogate id
-- gerekmedi).
create table if not exists public.product_catalogs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.product_catalogs (name, sort_order)
values ('dermakor', 0), ('swiss', 1)
on conflict (name) do nothing;

alter table public.products drop constraint if exists products_brand_line_check;
alter table public.products
  add constraint products_brand_line_catalog_fkey
  foreign key (brand_line) references public.product_catalogs (name)
  on update cascade on delete set null;

alter table public.product_catalogs enable row level security;

drop policy if exists "product_catalogs_select" on public.product_catalogs;
create policy "product_catalogs_select" on public.product_catalogs for select
  using (public.is_active_staff());

drop policy if exists "product_catalogs_write_admin" on public.product_catalogs;
create policy "product_catalogs_write_admin" on public.product_catalogs for insert
  with check (public.is_admin());

drop policy if exists "product_catalogs_delete_admin" on public.product_catalogs;
create policy "product_catalogs_delete_admin" on public.product_catalogs for delete
  using (public.is_admin());

comment on table public.product_catalogs is 'Admin tarafından yönetilen ürün hattı/katalog listesi (Stok > Tümü sekmesindeki gruplar). products.brand_line bu tablonun name''ine FK.';
