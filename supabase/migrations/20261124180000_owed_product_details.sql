-- Borçlu olduğumuz ürünlerde her sipariş kalemi ayrı ve ayrıntılı (kullanıcı isteği, 2026-11-24: "doktor ismi,
-- satış yapan kişi, verilen ürün kısmı, eksik kalan ürün kısmı ve hangi kongre/workshop vb.de alındığı ve tarihi
-- olmalı; ürünler tek tek ayrı ayrı alt alta; onun dışındaki yazılar not kısmında").
-- quantity = eksik kalan (gönderilecek) adet olarak kalır; diğer alanlar boş bırakılabilir, mevcut kayıtlar etkilenmez.
alter table public.customer_pending_products
  add column if not exists sales_rep_name text,
  add column if not exists event_name text,
  add column if not exists order_date date,
  add column if not exists ordered_quantity integer,
  add column if not exists delivered_quantity integer not null default 0,
  add column if not exists delivered_items text;

comment on column public.customer_pending_products.sales_rep_name is 'Satışı yapan kişi (temsilci adı, serbest metin)';
comment on column public.customer_pending_products.event_name is 'Siparişin alındığı kongre / workshop / masterclass';
comment on column public.customer_pending_products.order_date is 'Sipariş tarihi';
comment on column public.customer_pending_products.ordered_quantity is 'Sipariş edilen toplam adet (boşsa quantity + delivered_quantity)';
comment on column public.customer_pending_products.delivered_quantity is 'Şimdiye kadar verilen adet';
comment on column public.customer_pending_products.delivered_items is 'Aynı siparişten verilen ürünlerin adları, ör. "1 BVRS PL, 2 Polyboost Vola"';
