-- Kullanıcı isteğiyle (2026-08-21): Ana Panel'de elektrik/doğalgaz/su/internet
-- vb. sabit faturaları (sözleşme no, son ödeme tarihi, tutar) takip eden bir
-- Faturalar modülü. Tekrarlayan değil — kullanıcı her ay elle yeni bir kayıt
-- giriyor (kendi tercihi, otomatik şablon istemedi). Hatırlatma, mevcut
-- Hatırlatmalar/Ajanda sistemi üzerinden yapılıyor: bir fatura eklenince
-- otomatik olarak son ödeme tarihinde bir `reminders` satırı oluşturuluyor
-- (reminder_id ile geri bağlanıyor) — ayrı bir bildirim mekanizması
-- kurulmuyor, zaten var olan bildirim zili + Hatırlatmalar sayfası + Ajanda
-- takvimi bunu otomatik olarak gösterir.

create table public.utility_bills (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('elektrik', 'dogalgaz', 'su', 'internet', 'telefon', 'diger')),
  contract_number text,
  amount numeric(10, 2) not null check (amount >= 0),
  due_date date not null,
  is_paid boolean not null default false,
  note text,
  reminder_id uuid references public.reminders (id) on delete set null,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index utility_bills_due_date_idx on public.utility_bills (due_date);

drop trigger if exists set_updated_at on public.utility_bills;
create trigger set_updated_at before update on public.utility_bills
for each row execute function public.set_updated_at();

alter table public.utility_bills enable row level security;

drop policy if exists "utility_bills_all_staff" on public.utility_bills;
create policy "utility_bills_all_staff" on public.utility_bills for all
  using (public.is_active_staff()) with check (public.is_active_staff());
