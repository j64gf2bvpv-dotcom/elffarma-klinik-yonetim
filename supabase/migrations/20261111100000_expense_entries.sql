-- Giderler bölümleri (kullanıcı isteği, 2026-11-11): Elektrik / Su / İnternet (Türksat)
-- için abone no, sözleşme no, ödeme tarihi, ödenen tutar; Ofis / Mutfak / Ofis Yemek için
-- tarih, tutar, açıklama. Her bölüm ayrı sekme ve ayrı Excel; fatura/fiş görüntüleri
-- (resim/PDF) documents bucket'ında expense-entries/ altında, tarih aralığıyla toplu PDF.
create table if not exists public.expense_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('elektrik', 'su', 'internet', 'ofis', 'mutfak', 'ofis_yemek')),
  entry_date date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  subscriber_number text,
  contract_number text,
  description text,
  attachment_paths text[] not null default '{}',
  created_by uuid references public.staff (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expense_entries_category_date_idx on public.expense_entries (category, entry_date desc);

drop trigger if exists set_updated_at on public.expense_entries;
create trigger set_updated_at before update on public.expense_entries
for each row execute function public.set_updated_at();

alter table public.expense_entries enable row level security;

drop policy if exists "expense_entries_all_staff" on public.expense_entries;
create policy "expense_entries_all_staff" on public.expense_entries for all
  using (public.is_active_staff()) with check (public.is_active_staff());
