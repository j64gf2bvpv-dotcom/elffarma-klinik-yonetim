-- Satış Temsilcisi Raporu'nda "Bu Hafta Ciro" / "Bu Ay Ciro" elle girilebilsin (kullanıcı isteği, 2026-11-19:
-- "satış ciro kısmında buton olsun manuel girebilelim her satışçıda"). Girilen tutar o dönem için
-- tahsilatlardan hesaplanan cironun yerine gösterilir; silinince otomatik hesaba döner.
create table if not exists public.sales_rep_manual_revenue (
  id uuid primary key default gen_random_uuid(),
  sales_rep_id uuid not null references public.sales_reps(id) on delete cascade,
  period_type text not null check (period_type in ('week', 'month')),
  period_start date not null,
  amount numeric(14, 2) not null check (amount >= 0),
  updated_by uuid references public.staff(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (sales_rep_id, period_type, period_start)
);

alter table public.sales_rep_manual_revenue enable row level security;

drop policy if exists "staff read manual revenue" on public.sales_rep_manual_revenue;
create policy "staff read manual revenue" on public.sales_rep_manual_revenue
  for select using (public.is_active_staff());
drop policy if exists "staff write manual revenue" on public.sales_rep_manual_revenue;
create policy "staff write manual revenue" on public.sales_rep_manual_revenue
  for all using (public.is_active_staff()) with check (public.is_active_staff());
