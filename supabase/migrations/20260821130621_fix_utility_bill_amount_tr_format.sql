-- generate_due_utility_bills() az önce eklendi ama tutarı ABD biçiminde
-- ("1,500.00") yazıyordu — uygulamanın geri kalanı (toLocaleString('tr-TR'))
-- gibi Türkçe biçimde ("1.500,00") olmalı. to_char'ın G/D sembolleri sunucu
-- locale'ine bağlı olduğu için güvenilir değil — elle değiştiriyoruz.
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
        'Tutar: ' || v_amount_tr || ' ₺',
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
