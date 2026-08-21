-- Kullanıcı isteğiyle (2026-08-21): faturalar her ay elle girilmek yerine,
-- "her ayın X'inde" tekrarlayan bir şablon tanımlanıp sistem OTOMATİK olarak
-- o ayın fatura kaydını (+ 7 gün önceden hatırlatmasını) oluştursun. Bu,
-- Electron masaüstü uygulaması her zaman açık olmadığı için İSTEMCİ
-- TARAFINDA (uygulama açılınca kontrol et) değil, VERİTABANI TARAFINDA
-- (pg_cron, günlük) çalışıyor — aksi halde kimse uygulamayı o gün açmazsa
-- fatura hiç oluşmaz, otomatikliğin amacı boşa çıkardı.

create extension if not exists pg_cron;

create table public.utility_bill_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('elektrik', 'dogalgaz', 'su', 'internet', 'telefon', 'diger')),
  contract_number text,
  amount numeric(10, 2) not null check (amount >= 0),
  day_of_month integer not null check (day_of_month between 1 and 31),
  note text,
  is_active boolean not null default true,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.utility_bill_templates;
create trigger set_updated_at before update on public.utility_bill_templates
for each row execute function public.set_updated_at();

alter table public.utility_bill_templates enable row level security;

drop policy if exists "utility_bill_templates_all_staff" on public.utility_bill_templates;
create policy "utility_bill_templates_all_staff" on public.utility_bill_templates for all
  using (public.is_active_staff()) with check (public.is_active_staff());

-- Otomatik üretilen faturaları izlemek/ayırt etmek için — hangi şablondan
-- geldiği, o şablon için "bu ay zaten üretildi mi" kontrolünde kullanılıyor.
alter table public.utility_bills add column if not exists template_id uuid references public.utility_bill_templates (id) on delete set null;

-- Her aktif şablon için: bu ayın hedef günü (ay daha kısaysa son güne kırpılır)
-- geçmişse/gelmişse VE bu ay için henüz üretilmemişse, faturayı + son ödeme
-- tarihinden 7 gün önce düşecek hatırlatmayı oluşturur. SECURITY DEFINER
-- olduğu için RLS'i (is_active_staff auth.uid() gerektirir, pg_cron bağlamında
-- yok) atlayarak çalışır — tıpkı diğer sistem RPC'leri gibi.
create or replace function public.generate_due_utility_bills()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template record;
  v_days_in_month integer;
  v_target_date date;
  v_reminder_id uuid;
  v_category_label text;
  v_count integer := 0;
begin
  for v_template in select * from utility_bill_templates where is_active = true loop
    v_days_in_month := extract(day from ((date_trunc('month', current_date) + interval '1 month - 1 day')))::integer;
    v_target_date := date_trunc('month', current_date)::date + (least(v_template.day_of_month, v_days_in_month) - 1);

    if exists (
      select 1 from utility_bills
      where template_id = v_template.id
        and due_date >= date_trunc('month', current_date)::date
        and due_date < (date_trunc('month', current_date) + interval '1 month')::date
    ) then
      continue;
    end if;

    v_category_label := case v_template.category
      when 'elektrik' then 'Elektrik'
      when 'dogalgaz' then 'Doğalgaz'
      when 'su' then 'Su'
      when 'internet' then 'İnternet'
      when 'telefon' then 'Telefon'
      else 'Diğer'
    end;

    insert into reminders (title, note, due_date)
    values (
      v_category_label || ' Faturası — Son Ödeme Yaklaşıyor',
      concat_ws(
        ' — ',
        'Son ödeme tarihi: ' || to_char(v_target_date, 'DD.MM.YYYY'),
        case when v_template.contract_number is not null then 'Sözleşme No: ' || v_template.contract_number end,
        'Tutar: ' || to_char(v_template.amount, 'FM999G999G999D00') || ' ₺',
        v_template.note
      ),
      v_target_date - 7
    )
    returning id into v_reminder_id;

    insert into utility_bills (category, contract_number, amount, due_date, note, reminder_id, template_id)
    values (v_template.category, v_template.contract_number, v_template.amount, v_target_date, v_template.note, v_reminder_id, v_template.id);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.generate_due_utility_bills() to authenticated, service_role;

select cron.schedule(
  'generate-due-utility-bills',
  '0 6 * * *',
  $$select public.generate_due_utility_bills()$$
);
