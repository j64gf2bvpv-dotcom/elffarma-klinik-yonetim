-- Faturalara "Abone No" (kullanıcı isteği, 2026-10-14: "faturalar kısmına abone
-- numarası da eklensin"). Hem tekil faturalarda hem tekrarlayan fatura
-- şablonlarında; generate_due_utility_bills() şablondaki abone numarasını
-- oluşturduğu faturaya ve hatırlatma notuna da taşıyor.
alter table public.utility_bills add column if not exists subscriber_number text;
alter table public.utility_bill_templates add column if not exists subscriber_number text;
comment on column public.utility_bills.subscriber_number is 'Abone numarası';
comment on column public.utility_bill_templates.subscriber_number is 'Abone numarası';

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
  v_amount_tr text;
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

    -- "1,500.00" (US biçimi) -> "1.500,00" (TR biçimi): geçici bir yer
    -- tutucuyla ayraçları takas ediyoruz.
    v_amount_tr := replace(
      replace(
        replace(to_char(v_template.amount, 'FM999G999G999D00'), ',', '§'),
        '.', ','
      ),
      '§', '.'
    );

    insert into reminders (title, note, due_date)
    values (
      v_category_label || ' Faturası — Son Ödeme Yaklaşıyor',
      concat_ws(
        ' — ',
        'Son ödeme tarihi: ' || to_char(v_target_date, 'DD.MM.YYYY'),
        case when v_template.contract_number is not null then 'Sözleşme No: ' || v_template.contract_number end,
        case when v_template.subscriber_number is not null then 'Abone No: ' || v_template.subscriber_number end,
        'Tutar: ' || v_amount_tr || ' ₺',
        v_template.note
      ),
      v_target_date - 7
    )
    returning id into v_reminder_id;

    insert into utility_bills (category, contract_number, subscriber_number, amount, due_date, note, reminder_id, template_id)
    values (v_template.category, v_template.contract_number, v_template.subscriber_number, v_template.amount, v_target_date, v_template.note, v_reminder_id, v_template.id);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
