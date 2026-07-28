-- Kongreye katılım planı alanı
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

alter table public.congresses
  add column if not exists will_attend boolean not null default false;

comment on column public.congresses.will_attend is 'Bu kongreye katılım planlanıyor mu (true) — uygulamada uyarı rozetiyle gösterilir';
