-- Hatırlatmalar ve Ajanda modülleri için basit görev/hatırlatma tablosu.
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  note text,
  due_date date not null,
  is_done boolean not null default false,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now()
);
create index if not exists reminders_due_date_idx on public.reminders (due_date);

alter table public.reminders enable row level security;

drop policy if exists "reminders_all_staff" on public.reminders;
create policy "reminders_all_staff" on public.reminders for all
  using (public.is_active_staff()) with check (public.is_active_staff());

comment on table public.reminders is 'Ödeme, kongre ve görev hatırlatmaları (Hatırlatmalar ve Ajanda modülleri)';
