-- Personel arası kişiye özel mesaj (kullanıcı isteği, 2026-10-14: "çevrimiçi
-- personelin üzerine tıklayıp mesaj atabileyim"). Var olan ama uygulamada
-- kullanılmayan staff_messages (tek ortak "Ekip Sohbeti" kanalı) genişletiliyor:
--  - recipient_id: doluysa kişiye özel mesaj; boşsa ortak kanal (eski davranış)
--  - read_at: alıcının okuduğu an (okunmamış bildirimi için)
-- Kişiye özel mesajları SADECE gönderen ve alıcı görür; okundu bilgisini
-- sadece alıcı işaretleyebilir. Anlık bildirim için realtime yayınına eklenir.
alter table public.staff_messages
  add column if not exists recipient_id uuid references public.staff(id) on delete cascade,
  add column if not exists read_at timestamptz;

create index if not exists staff_messages_dm_idx on public.staff_messages (recipient_id, sender_id, created_at desc);

drop policy if exists staff_messages_select on public.staff_messages;
create policy staff_messages_select on public.staff_messages for select
  using (
    public.is_active_staff()
    and (recipient_id is null or sender_id = auth.uid() or recipient_id = auth.uid())
  );

drop policy if exists staff_messages_insert on public.staff_messages;
create policy staff_messages_insert on public.staff_messages for insert
  with check (public.is_active_staff() and sender_id = auth.uid());

drop policy if exists staff_messages_mark_read on public.staff_messages;
create policy staff_messages_mark_read on public.staff_messages for update
  using (public.is_active_staff() and recipient_id = auth.uid())
  with check (public.is_active_staff() and recipient_id = auth.uid());

-- Alıcı sadece read_at'i değiştirebilsin (gövde/gönderen değişmesin)
create or replace function public.staff_messages_only_read_at()
returns trigger
language plpgsql
as $$
begin
  if (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
    raise exception 'Mesaj içeriği değiştirilemez';
  end if;
  return new;
end;
$$;
drop trigger if exists staff_messages_only_read_at on public.staff_messages;
create trigger staff_messages_only_read_at before update on public.staff_messages
  for each row execute function public.staff_messages_only_read_at();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff_messages'
  ) then
    alter publication supabase_realtime add table public.staff_messages;
  end if;
end $$;
