-- BU DOSYANIN TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.
-- İki eksik parçayı tamamlar: (1) kongre "kalan ürünler" tablosu, (2) fatura dosyaları deposu.

-- 1) Kongreye götürülen ama doktora dağıtılmayan (kalan) ürünler
create table if not exists public.congress_remaining_products (
  id uuid primary key default gen_random_uuid(),
  congress_id uuid not null references public.congresses (id) on delete cascade,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists congress_remaining_products_congress_idx on public.congress_remaining_products (congress_id);

alter table public.congress_remaining_products enable row level security;

drop policy if exists "congress_remaining_products_all_staff" on public.congress_remaining_products;
create policy "congress_remaining_products_all_staff" on public.congress_remaining_products for all
  using (public.is_active_staff()) with check (public.is_active_staff());

-- 2) Fatura dosyaları için özel (private) depolama alanı (daha önce eksik kalmış)
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

drop policy if exists "invoices_select_staff" on storage.objects;
create policy "invoices_select_staff" on storage.objects for select
  using (bucket_id = 'invoices' and auth.uid() is not null);

drop policy if exists "invoices_insert_staff" on storage.objects;
create policy "invoices_insert_staff" on storage.objects for insert
  with check (bucket_id = 'invoices' and auth.uid() is not null);

drop policy if exists "invoices_update_staff" on storage.objects;
create policy "invoices_update_staff" on storage.objects for update
  using (bucket_id = 'invoices' and auth.uid() is not null);

drop policy if exists "invoices_delete_staff" on storage.objects;
create policy "invoices_delete_staff" on storage.objects for delete
  using (bucket_id = 'invoices' and auth.uid() is not null);
