-- Faturalar: Elektrik / Su / Doğalgaz / İnternet gibi abonelik başlıkları kalıcı olsun,
-- silinemesin; sadece içlerine eklenen faturalar silinebilsin (kullanıcı isteği, 2026-11-11).
-- Önceden başlık faturalardan türetiliyordu — son fatura silinince başlık da kayboluyordu.
-- DELETE politikası bilerek YOK: uygulamadan kimse abonelik başlığını silemez.
create table if not exists public.utility_subscriptions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('elektrik', 'dogalgaz', 'su', 'internet', 'telefon', 'diger')),
  contract_number text not null default '',
  subscriber_number text,
  subscriber_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, contract_number)
);

drop trigger if exists set_updated_at on public.utility_subscriptions;
create trigger set_updated_at before update on public.utility_subscriptions
for each row execute function public.set_updated_at();

alter table public.utility_subscriptions enable row level security;

drop policy if exists "utility_subscriptions_select" on public.utility_subscriptions;
create policy "utility_subscriptions_select" on public.utility_subscriptions for select using (public.is_active_staff());
drop policy if exists "utility_subscriptions_insert" on public.utility_subscriptions;
create policy "utility_subscriptions_insert" on public.utility_subscriptions for insert with check (public.is_active_staff());
drop policy if exists "utility_subscriptions_update" on public.utility_subscriptions;
create policy "utility_subscriptions_update" on public.utility_subscriptions for update
  using (public.is_active_staff()) with check (public.is_active_staff());

-- Her fatura (elle ya da her ay otomatik açılan) kendi abonelik başlığını garanti eder;
-- faturada abone no / adı varsa başlıktakini günceller.
create or replace function public.ensure_utility_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into utility_subscriptions (category, contract_number, subscriber_number, subscriber_name)
  values (new.category, coalesce(trim(new.contract_number), ''), nullif(trim(new.subscriber_number), ''), nullif(trim(new.subscriber_name), ''))
  on conflict (category, contract_number) do update
    set subscriber_number = coalesce(excluded.subscriber_number, utility_subscriptions.subscriber_number),
        subscriber_name = coalesce(excluded.subscriber_name, utility_subscriptions.subscriber_name);
  return new;
end;
$$;

drop trigger if exists ensure_utility_subscription on public.utility_bills;
create trigger ensure_utility_subscription
after insert or update of category, contract_number, subscriber_number, subscriber_name on public.utility_bills
for each row execute function public.ensure_utility_subscription();

-- Mevcut faturalardan ve tekrarlayan şablonlardan başlıkları oluştur
insert into public.utility_subscriptions (category, contract_number, subscriber_number, subscriber_name)
select category, coalesce(trim(contract_number), ''), max(nullif(trim(subscriber_number), '')), max(nullif(trim(subscriber_name), ''))
from (
  select category, contract_number, subscriber_number, subscriber_name from public.utility_bills
  union all
  select category, contract_number, subscriber_number, subscriber_name from public.utility_bill_templates
) s
group by 1, 2
on conflict (category, contract_number) do nothing;
