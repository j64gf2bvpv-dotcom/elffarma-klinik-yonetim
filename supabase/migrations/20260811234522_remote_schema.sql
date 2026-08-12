-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

CREATE SEQUENCE public.doctor_code_seq;

GRANT ALL ON SEQUENCE public.doctor_code_seq TO anon;

GRANT ALL ON SEQUENCE public.doctor_code_seq TO authenticated;

GRANT ALL ON SEQUENCE public.doctor_code_seq TO service_role;

CREATE SEQUENCE public.product_sku_seq;

GRANT ALL ON SEQUENCE public.product_sku_seq TO anon;

GRANT ALL ON SEQUENCE public.product_sku_seq TO authenticated;

GRANT ALL ON SEQUENCE public.product_sku_seq TO service_role;

CREATE FUNCTION public.assign_product_sku()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  if new.sku is null or btrim(new.sku) = '' then
    new.sku := to_char(nextval('public.product_sku_seq'), 'FM0000');
  end if;
  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.assign_product_sku() TO anon;

GRANT ALL ON FUNCTION public.assign_product_sku() TO authenticated;

GRANT ALL ON FUNCTION public.assign_product_sku() TO service_role;

CREATE FUNCTION public.delete_stock_movement (
  p_movement_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_row public.stock_movements;
  v_delta integer;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  select * into v_row from public.stock_movements where id = p_movement_id;
  if not found then
    raise exception 'Hareket bulunamadı';
  end if;

  v_delta := public.stock_movement_delta(v_row.movement_type, v_row.quantity);

  update public.products
  set current_quantity = greatest(0, current_quantity - v_delta),
      updated_at = now()
  where id = v_row.product_id;

  if v_row.lot_id is not null then
    update public.product_lots
    set quantity = greatest(0, quantity - v_delta),
        updated_at = now()
    where id = v_row.lot_id;
  end if;

  delete from public.stock_movements where id = p_movement_id;
end;
$function$;

GRANT ALL ON FUNCTION public.delete_stock_movement(uuid) TO anon;

GRANT ALL ON FUNCTION public.delete_stock_movement(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.delete_stock_movement(uuid) TO service_role;

CREATE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  first_user boolean;
begin
  select not exists (select 1 from public.staff) into first_user;
  insert into public.staff (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when first_user then 'admin' else 'staff' end
  );
  return new;
end;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;

GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;

GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

CREATE FUNCTION public.is_active_staff()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from public.staff
    where id = auth.uid() and is_active = true
  );
$function$;

GRANT ALL ON FUNCTION public.is_active_staff() TO anon;

GRANT ALL ON FUNCTION public.is_active_staff() TO authenticated;

GRANT ALL ON FUNCTION public.is_active_staff() TO service_role;

CREATE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from public.staff
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$function$;

GRANT ALL ON FUNCTION public.is_admin() TO anon;

GRANT ALL ON FUNCTION public.is_admin() TO authenticated;

GRANT ALL ON FUNCTION public.is_admin() TO service_role;

CREATE FUNCTION public.protect_staff_privileged_columns()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
    new.full_name := old.full_name;
  end if;
  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.protect_staff_privileged_columns() TO anon;

GRANT ALL ON FUNCTION public.protect_staff_privileged_columns() TO authenticated;

GRANT ALL ON FUNCTION public.protect_staff_privileged_columns() TO service_role;

CREATE FUNCTION public.set_doctor_code()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  if new.doctor_code is null then
    new.doctor_code := 'DOC-' || lpad(nextval('public.doctor_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.set_doctor_code() TO anon;

GRANT ALL ON FUNCTION public.set_doctor_code() TO authenticated;

GRANT ALL ON FUNCTION public.set_doctor_code() TO service_role;

CREATE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;

GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;

GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;

CREATE FUNCTION public.stock_movement_delta (
  p_movement_type text,
  p_quantity      integer
)
  RETURNS integer
  LANGUAGE sql
  IMMUTABLE
  AS $function$
  select case p_movement_type
    when 'in' then p_quantity
    when 'out' then -p_quantity
    when 'sample' then -p_quantity
    when 'return' then p_quantity
    when 'disposal' then -p_quantity
    when 'adjustment' then p_quantity
    else 0
  end;
$function$;

GRANT ALL ON FUNCTION public.stock_movement_delta(text, integer) TO anon;

GRANT ALL ON FUNCTION public.stock_movement_delta(text, integer) TO authenticated;

GRANT ALL ON FUNCTION public.stock_movement_delta(text, integer) TO service_role;

CREATE TABLE public.admin_secrets (
  key        text                     NOT NULL,
  value      jsonb                    NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.admin_secrets IS 'Sadece admin''in okuyup yazabildiği gizli anahtar deposu (ör. google_drive_backup key''i altında bir servis hesabı JSON''ı) — app_settings''ten farklı olarak SELECT de admin''e kapalı';

ALTER TABLE public.admin_secrets
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_secrets
  ADD CONSTRAINT admin_secrets_pkey PRIMARY KEY (key);

GRANT ALL ON public.admin_secrets TO anon;

GRANT ALL ON public.admin_secrets TO authenticated;

GRANT ALL ON public.admin_secrets TO service_role;

CREATE POLICY admin_secrets_admin_all ON public.admin_secrets
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE public.ai_conversations (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  title      text                     DEFAULT 'Yeni Konuşma'::text NOT NULL,
  provider   text,
  model      text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.ai_conversations IS 'AIService üzerinden yürütülen konuşmaların üst kaydı (sağlayıcıdan bağımsız)';

ALTER TABLE public.ai_conversations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_conversations
  ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);

GRANT ALL ON public.ai_conversations TO anon;

GRANT ALL ON public.ai_conversations TO authenticated;

GRANT ALL ON public.ai_conversations TO service_role;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY ai_conversations_all_staff ON public.ai_conversations
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.ai_messages (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  conversation_id uuid                     NOT NULL,
  role            text                     NOT NULL,
  content         text                     NOT NULL,
  created_at      timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.ai_messages IS 'Bir AI konuşmasındaki tek tek mesajlar (kullanıcı/asistan/sistem)';

ALTER TABLE public.ai_messages
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_messages
  ADD CONSTRAINT ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;

ALTER TABLE public.ai_messages
  ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);

ALTER TABLE public.ai_messages
  ADD CONSTRAINT ai_messages_role_check CHECK (role = ANY (ARRAY['system'::text, 'user'::text, 'assistant'::text]));

GRANT ALL ON public.ai_messages TO anon;

GRANT ALL ON public.ai_messages TO authenticated;

GRANT ALL ON public.ai_messages TO service_role;

CREATE INDEX ai_messages_conversation_id_idx ON public.ai_messages (conversation_id);

CREATE POLICY ai_messages_all_staff ON public.ai_messages
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.ai_usage_logs (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  provider          text                     NOT NULL,
  model             text                     NOT NULL,
  success           boolean                  NOT NULL,
  duration_ms       integer,
  prompt_tokens     integer,
  completion_tokens integer,
  error_message     text,
  created_by        uuid,
  created_at        timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.ai_usage_logs IS 'AIService çağrılarının denetim/hata/performans kaydı — düzenlenmez, sadece eklenir';

ALTER TABLE public.ai_usage_logs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_usage_logs
  ADD CONSTRAINT ai_usage_logs_pkey PRIMARY KEY (id);

GRANT ALL ON public.ai_usage_logs TO anon;

GRANT ALL ON public.ai_usage_logs TO authenticated;

GRANT ALL ON public.ai_usage_logs TO service_role;

CREATE INDEX ai_usage_logs_created_at_idx ON public.ai_usage_logs (created_at);

CREATE POLICY ai_usage_logs_insert_staff ON public.ai_usage_logs
  FOR INSERT
  WITH CHECK (public.is_active_staff());

CREATE POLICY ai_usage_logs_select_staff ON public.ai_usage_logs
  FOR SELECT
  USING (public.is_active_staff());

CREATE TABLE public.app_settings (
  key        text                     NOT NULL,
  value      jsonb                    NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.app_settings
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);

GRANT ALL ON public.app_settings TO anon;

GRANT ALL ON public.app_settings TO authenticated;

GRANT ALL ON public.app_settings TO service_role;

CREATE POLICY app_settings_delete_admin ON public.app_settings
  FOR DELETE
  USING (public.is_admin());

CREATE POLICY app_settings_insert_admin ON public.app_settings
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY app_settings_select_staff ON public.app_settings
  FOR SELECT
  USING (public.is_active_staff());

CREATE POLICY app_settings_update_admin ON public.app_settings
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE public.appointments (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  customer_id   uuid                     NOT NULL,
  title         text                     NOT NULL,
  notes         text,
  scheduled_at  timestamp with time zone NOT NULL,
  status        text                     DEFAULT 'planned'::text NOT NULL,
  reminder_sent boolean                  DEFAULT false NOT NULL,
  created_by    uuid,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.appointments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check CHECK (status = ANY (ARRAY['planned'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text]));

GRANT ALL ON public.appointments TO anon;

GRANT ALL ON public.appointments TO authenticated;

GRANT ALL ON public.appointments TO service_role;

CREATE INDEX appointments_customer_idx ON public.appointments (customer_id);

CREATE INDEX appointments_scheduled_idx ON public.appointments (scheduled_at);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY appointments_all_staff ON public.appointments
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.attachments (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  owner_type  text                     NOT NULL,
  owner_id    uuid                     NOT NULL,
  file_path   text                     NOT NULL,
  file_name   text                     NOT NULL,
  uploaded_by uuid,
  created_at  timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.attachments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_owner_type_check CHECK (owner_type = ANY (ARRAY['customer'::text, 'clinic'::text, 'congress'::text, 'workshop'::text, 'doctor_visit'::text]));

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);

GRANT ALL ON public.attachments TO anon;

GRANT ALL ON public.attachments TO authenticated;

GRANT ALL ON public.attachments TO service_role;

CREATE INDEX attachments_owner_idx ON public.attachments (owner_type, owner_id);

CREATE POLICY attachments_all_staff ON public.attachments
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.audit_logs (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  staff_id    uuid,
  staff_name  text                     NOT NULL,
  action      text                     NOT NULL,
  table_name  text                     NOT NULL,
  record_id   text,
  description text                     NOT NULL,
  payload     jsonb,
  created_at  timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.audit_logs IS 'Değiştirilemez/silinemez işlem kaydı — sadece INSERT policy''si var, admin okuyabilir';

ALTER TABLE public.audit_logs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_action_check CHECK (action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text, 'rpc'::text]));

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

GRANT ALL ON public.audit_logs TO anon;

GRANT ALL ON public.audit_logs TO authenticated;

GRANT ALL ON public.audit_logs TO service_role;

CREATE INDEX audit_logs_table_idx ON public.audit_logs (table_name);

CREATE INDEX audit_logs_staff_idx ON public.audit_logs (staff_id);

CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);

CREATE POLICY audit_logs_insert_active_staff ON public.audit_logs
  FOR INSERT
  WITH CHECK (public.is_active_staff());

CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT
  USING (public.is_admin());

CREATE TABLE public.budget_targets (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  year           integer                  NOT NULL,
  month          integer                  NOT NULL,
  target_revenue numeric(12,2)            DEFAULT 0 NOT NULL,
  created_by     uuid,
  created_at     timestamp with time zone DEFAULT now() NOT NULL,
  updated_at     timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.budget_targets IS 'Yıllık/aylık ciro bütçe hedefleri (Bütçe Yılı modülü)';

ALTER TABLE public.budget_targets
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.budget_targets
  ADD CONSTRAINT budget_targets_month_check CHECK (month >= 1 AND month <= 12);

ALTER TABLE public.budget_targets
  ADD CONSTRAINT budget_targets_pkey PRIMARY KEY (id);

ALTER TABLE public.budget_targets
  ADD CONSTRAINT budget_targets_year_month_key UNIQUE (year, month);

GRANT ALL ON public.budget_targets TO anon;

GRANT ALL ON public.budget_targets TO authenticated;

GRANT ALL ON public.budget_targets TO service_role;

CREATE INDEX budget_targets_year_idx ON public.budget_targets (year);

CREATE POLICY budget_targets_all_staff ON public.budget_targets
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.clinics (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name               text                     NOT NULL,
  authorized_persons text,
  address            text,
  phone              text,
  tax_office         text,
  tax_number         text,
  employee_count     integer,
  branch_count       integer,
  sales_rep_id       uuid,
  region_id          uuid,
  category           text,
  is_vip             boolean                  DEFAULT false NOT NULL,
  risk_limit         numeric(12,2),
  discount_rate      numeric(5,2),
  payment_method     text,
  working_days       text[]                   DEFAULT '{}'::text[] NOT NULL,
  maps_url           text,
  notes              text,
  created_by         uuid,
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  updated_at         timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.clinics
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_pkey PRIMARY KEY (id);

GRANT ALL ON public.clinics TO anon;

GRANT ALL ON public.clinics TO authenticated;

GRANT ALL ON public.clinics TO service_role;

CREATE INDEX clinics_name_idx ON public.clinics USING gin (to_tsvector('simple'::regconfig, name));

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY clinics_all_staff ON public.clinics
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.commission_adjustments (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  sales_rep_id    uuid                     NOT NULL,
  adjustment_type text                     NOT NULL,
  amount          numeric(12,2)            NOT NULL,
  period_start    date                     NOT NULL,
  period_end      date                     NOT NULL,
  note            text,
  created_by      uuid,
  created_at      timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.commission_adjustments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.commission_adjustments
  ADD CONSTRAINT commission_adjustments_adjustment_type_check CHECK (adjustment_type = ANY (ARRAY['bonus'::text, 'ceza'::text]));

ALTER TABLE public.commission_adjustments
  ADD CONSTRAINT commission_adjustments_amount_check CHECK (amount >= 0::numeric);

ALTER TABLE public.commission_adjustments
  ADD CONSTRAINT commission_adjustments_pkey PRIMARY KEY (id);

GRANT ALL ON public.commission_adjustments TO anon;

GRANT ALL ON public.commission_adjustments TO authenticated;

GRANT ALL ON public.commission_adjustments TO service_role;

CREATE INDEX commission_adjustments_rep_idx ON public.commission_adjustments (sales_rep_id, period_start);

CREATE POLICY commission_adjustments_all_staff ON public.commission_adjustments
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.commission_rules (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name         text                     NOT NULL,
  scope_type   text                     NOT NULL,
  scope_value  text,
  basis        text                     NOT NULL,
  rate_percent numeric(5,2)             NOT NULL,
  is_active    boolean                  DEFAULT true NOT NULL,
  created_by   uuid,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.commission_rules
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.commission_rules
  ADD CONSTRAINT commission_rules_basis_check CHECK (basis = ANY (ARRAY['satis'::text, 'tahsilat'::text]));

ALTER TABLE public.commission_rules
  ADD CONSTRAINT commission_rules_pkey PRIMARY KEY (id);

ALTER TABLE public.commission_rules
  ADD CONSTRAINT commission_rules_rate_percent_check CHECK (rate_percent >= 0::numeric);

ALTER TABLE public.commission_rules
  ADD CONSTRAINT commission_rules_scope_type_check
    CHECK (scope_type = ANY (ARRAY['all'::text, 'product'::text, 'category'::text, 'brand'::text, 'sales_rep'::text, 'clinic'::text, 'customer'::text]));

GRANT ALL ON public.commission_rules TO anon;

GRANT ALL ON public.commission_rules TO authenticated;

GRANT ALL ON public.commission_rules TO service_role;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY commission_rules_all_staff ON public.commission_rules
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.competitor_reports (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  customer_id     uuid,
  doctor_name     text,
  competitor_name text                     NOT NULL,
  product_name    text                     NOT NULL,
  stock_status    text,
  price           numeric(10,2),
  visibility      text,
  notes           text,
  reported_by     uuid,
  created_at      timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.competitor_reports IS 'Saha rekabet analizi — rakip ürün stok/fiyat/görünürlük raporu';

ALTER TABLE public.competitor_reports
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.competitor_reports
  ADD CONSTRAINT competitor_reports_pkey PRIMARY KEY (id);

ALTER TABLE public.competitor_reports
  ADD CONSTRAINT competitor_reports_stock_status_check CHECK (stock_status = ANY (ARRAY['in_stock'::text, 'limited'::text, 'out_of_stock'::text]));

ALTER TABLE public.competitor_reports
  ADD CONSTRAINT competitor_reports_visibility_check CHECK (visibility = ANY (ARRAY['good'::text, 'moderate'::text, 'poor'::text]));

GRANT ALL ON public.competitor_reports TO anon;

GRANT ALL ON public.competitor_reports TO authenticated;

GRANT ALL ON public.competitor_reports TO service_role;

CREATE INDEX competitor_reports_customer_idx ON public.competitor_reports (customer_id);

CREATE INDEX competitor_reports_created_idx ON public.competitor_reports (created_at DESC);

CREATE POLICY competitor_reports_all_staff ON public.competitor_reports
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.congress_checklist_items (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  congress_id uuid                     NOT NULL,
  label       text                     NOT NULL,
  is_done     boolean                  DEFAULT false NOT NULL,
  created_by  uuid,
  created_at  timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.congress_checklist_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.congress_checklist_items
  ADD CONSTRAINT congress_checklist_items_pkey PRIMARY KEY (id);

GRANT ALL ON public.congress_checklist_items TO anon;

GRANT ALL ON public.congress_checklist_items TO authenticated;

GRANT ALL ON public.congress_checklist_items TO service_role;

CREATE INDEX congress_checklist_items_congress_idx ON public.congress_checklist_items (congress_id);

CREATE POLICY congress_checklist_items_all_staff ON public.congress_checklist_items
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.congress_consumables (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  congress_id uuid                     NOT NULL,
  name        text                     NOT NULL,
  quantity    integer                  DEFAULT 1 NOT NULL,
  is_used     boolean                  DEFAULT false NOT NULL,
  note        text,
  created_by  uuid,
  created_at  timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.congress_consumables
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.congress_consumables
  ADD CONSTRAINT congress_consumables_pkey PRIMARY KEY (id);

GRANT ALL ON public.congress_consumables TO anon;

GRANT ALL ON public.congress_consumables TO authenticated;

GRANT ALL ON public.congress_consumables TO service_role;

CREATE INDEX congress_consumables_congress_idx ON public.congress_consumables (congress_id);

CREATE POLICY congress_consumables_all_staff ON public.congress_consumables
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.congress_participant_products (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  participant_id uuid                     NOT NULL,
  product_name   text                     NOT NULL,
  quantity       integer                  DEFAULT 1 NOT NULL,
  unit_price     numeric(10,2)            DEFAULT 0 NOT NULL,
  created_at     timestamp with time zone DEFAULT now() NOT NULL,
  sales_rep_id   uuid
);

COMMENT ON COLUMN public.congress_participant_products.sales_rep_id IS 'Bu ürünü doktora satan satış temsilcisi';

ALTER TABLE public.congress_participant_products
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.congress_participant_products
  ADD CONSTRAINT congress_participant_products_pkey PRIMARY KEY (id);

GRANT ALL ON public.congress_participant_products TO anon;

GRANT ALL ON public.congress_participant_products TO authenticated;

GRANT ALL ON public.congress_participant_products TO service_role;

CREATE INDEX congress_products_participant_idx ON public.congress_participant_products (participant_id);

CREATE POLICY congress_products_all_staff ON public.congress_participant_products
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.congress_participants (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  congress_id        uuid                     NOT NULL,
  doctor_name        text                     NOT NULL,
  flight_cost        numeric(10,2)            DEFAULT 0 NOT NULL,
  registration_cost  numeric(10,2)            DEFAULT 0 NOT NULL,
  accommodation_cost numeric(10,2)            DEFAULT 0 NOT NULL,
  notes              text,
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  updated_at         timestamp with time zone DEFAULT now() NOT NULL,
  attendance_status  text                     DEFAULT 'registered'::text NOT NULL,
  certificate_issued boolean                  DEFAULT false NOT NULL,
  qr_code            text
);

COMMENT ON COLUMN public.congress_participants.attendance_status IS 'Yoklama durumu: registered (kayıtlı/davetli), attended (katıldı), no_show (gelmedi)';

COMMENT ON COLUMN public.congress_participants.certificate_issued IS 'Katılım belgesi verildi mi';

COMMENT ON COLUMN public.congress_participants.qr_code IS 'QR kod kayıt/check-in için benzersiz metin kod';

ALTER TABLE public.congress_participants
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.congress_participants
  ADD CONSTRAINT congress_participants_attendance_status_check CHECK (attendance_status = ANY (ARRAY['registered'::text, 'attended'::text, 'no_show'::text]));

ALTER TABLE public.congress_participants
  ADD CONSTRAINT congress_participants_pkey PRIMARY KEY (id);

ALTER TABLE public.congress_participant_products
  ADD CONSTRAINT congress_participant_products_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.congress_participants(id) ON DELETE CASCADE;

ALTER TABLE public.congress_participants
  ADD CONSTRAINT congress_participants_qr_code_key UNIQUE (qr_code);

GRANT ALL ON public.congress_participants TO anon;

GRANT ALL ON public.congress_participants TO authenticated;

GRANT ALL ON public.congress_participants TO service_role;

CREATE INDEX congress_participants_congress_idx ON public.congress_participants (congress_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.congress_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY congress_participants_all_staff ON public.congress_participants
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.congress_remaining_products (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  congress_id  uuid                     NOT NULL,
  product_name text                     NOT NULL,
  quantity     integer                  DEFAULT 1 NOT NULL,
  unit_price   numeric(10,2)            DEFAULT 0 NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.congress_remaining_products
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.congress_remaining_products
  ADD CONSTRAINT congress_remaining_products_pkey PRIMARY KEY (id);

GRANT ALL ON public.congress_remaining_products TO anon;

GRANT ALL ON public.congress_remaining_products TO authenticated;

GRANT ALL ON public.congress_remaining_products TO service_role;

CREATE INDEX congress_remaining_products_congress_idx ON public.congress_remaining_products (congress_id);

CREATE POLICY congress_remaining_products_all_staff ON public.congress_remaining_products
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.congress_stock_items (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  congress_id  uuid                     NOT NULL,
  product_id   uuid,
  product_name text                     NOT NULL,
  quantity     integer                  NOT NULL,
  status       text                     DEFAULT 'goturuldu'::text NOT NULL,
  unit_price   numeric(10,2),
  note         text,
  created_by   uuid,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.congress_stock_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.congress_stock_items
  ADD CONSTRAINT congress_stock_items_pkey PRIMARY KEY (id);

ALTER TABLE public.congress_stock_items
  ADD CONSTRAINT congress_stock_items_quantity_check CHECK (quantity > 0);

ALTER TABLE public.congress_stock_items
  ADD CONSTRAINT congress_stock_items_status_check CHECK (status = ANY (ARRAY['goturuldu'::text, 'kullanildi'::text, 'sarf_edildi'::text, 'geri_dondu'::text]));

GRANT ALL ON public.congress_stock_items TO anon;

GRANT ALL ON public.congress_stock_items TO authenticated;

GRANT ALL ON public.congress_stock_items TO service_role;

CREATE INDEX congress_stock_items_congress_idx ON public.congress_stock_items (congress_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.congress_stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY congress_stock_items_all_staff ON public.congress_stock_items
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.congresses (
  id                  uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name                text                     NOT NULL,
  start_date          date,
  end_date            date,
  notes               text,
  created_by          uuid,
  created_at          timestamp with time zone DEFAULT now() NOT NULL,
  updated_at          timestamp with time zone DEFAULT now() NOT NULL,
  will_attend         boolean                  DEFAULT false NOT NULL,
  single_person_price numeric(10,2),
  two_person_price    numeric(10,2),
  image_url           text,
  city                text,
  venue               text,
  hotel               text,
  capacity            integer,
  sponsorship_info    text,
  speakers            text,
  trainers            text,
  meal_plan           text,
  transfer_info       text,
  stand_info          text,
  budget              numeric(12,2),
  campaign_info       text,
  video_urls          text[]                   DEFAULT '{}'::text[] NOT NULL
);

COMMENT ON COLUMN public.congresses.will_attend IS 'Bu kongreye katılım planlanıyor mu (true) — uygulamada uyarı rozetiyle gösterilir';

COMMENT ON COLUMN public.congresses.single_person_price IS 'Opsiyonel: tek kişi katılım paket fiyatı';

COMMENT ON COLUMN public.congresses.two_person_price IS 'Opsiyonel: 2 kişi katılım paket fiyatı';

COMMENT ON COLUMN public.congresses.city IS 'Kongre veya workshopun yapıldığı şehir';

COMMENT ON COLUMN public.congresses.venue IS 'Salon bilgisi';

COMMENT ON COLUMN public.congresses.hotel IS 'Konaklama oteli';

COMMENT ON COLUMN public.congresses.capacity IS 'Kontenjan (maksimum katılımcı sayısı)';

COMMENT ON COLUMN public.congresses.sponsorship_info IS 'Sponsor(lar) ve sponsorluk detayları';

COMMENT ON COLUMN public.congresses.speakers IS 'Konuşmacılar';

COMMENT ON COLUMN public.congresses.trainers IS 'Eğitmenler';

COMMENT ON COLUMN public.congresses.meal_plan IS 'Yemek planı';

COMMENT ON COLUMN public.congresses.transfer_info IS 'Transfer bilgisi';

COMMENT ON COLUMN public.congresses.stand_info IS 'Stand bilgisi';

COMMENT ON COLUMN public.congresses.budget IS 'Planlanan bütçe';

COMMENT ON COLUMN public.congresses.campaign_info IS 'Kampanya bilgisi';

COMMENT ON COLUMN public.congresses.video_urls IS 'Kongre/workshop ile ilgili video linkleri (YouTube vb.)';

ALTER TABLE public.congresses
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.congresses
  ADD CONSTRAINT congresses_pkey PRIMARY KEY (id);

ALTER TABLE public.congress_checklist_items
  ADD CONSTRAINT congress_checklist_items_congress_id_fkey FOREIGN KEY (congress_id) REFERENCES public.congresses(id) ON DELETE CASCADE;

ALTER TABLE public.congress_consumables
  ADD CONSTRAINT congress_consumables_congress_id_fkey FOREIGN KEY (congress_id) REFERENCES public.congresses(id) ON DELETE CASCADE;

ALTER TABLE public.congress_participants
  ADD CONSTRAINT congress_participants_congress_id_fkey FOREIGN KEY (congress_id) REFERENCES public.congresses(id) ON DELETE CASCADE;

ALTER TABLE public.congress_remaining_products
  ADD CONSTRAINT congress_remaining_products_congress_id_fkey FOREIGN KEY (congress_id) REFERENCES public.congresses(id) ON DELETE CASCADE;

ALTER TABLE public.congress_stock_items
  ADD CONSTRAINT congress_stock_items_congress_id_fkey FOREIGN KEY (congress_id) REFERENCES public.congresses(id) ON DELETE CASCADE;

GRANT ALL ON public.congresses TO anon;

GRANT ALL ON public.congresses TO authenticated;

GRANT ALL ON public.congresses TO service_role;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.congresses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY congresses_all_staff ON public.congresses
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.crm_activities (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  customer_id    uuid                     NOT NULL,
  activity_type  text                     NOT NULL,
  subject        text,
  note           text,
  occurred_at    timestamp with time zone DEFAULT now() NOT NULL,
  follow_up_date date,
  sales_rep_id   uuid,
  created_by     uuid,
  created_at     timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.crm_activities IS 'Arama/WhatsApp/e-posta/toplantı/video görüşme/not aktivite logu (CRM)';

ALTER TABLE public.crm_activities
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_activities
  ADD CONSTRAINT crm_activities_activity_type_check
    CHECK (activity_type = ANY (ARRAY['arama'::text, 'whatsapp'::text, 'email'::text, 'toplanti'::text, 'video_gorusme'::text, 'not'::text]));

ALTER TABLE public.crm_activities
  ADD CONSTRAINT crm_activities_pkey PRIMARY KEY (id);

GRANT ALL ON public.crm_activities TO anon;

GRANT ALL ON public.crm_activities TO authenticated;

GRANT ALL ON public.crm_activities TO service_role;

CREATE INDEX crm_activities_customer_idx ON public.crm_activities (customer_id, occurred_at DESC);

CREATE POLICY crm_activities_all_staff ON public.crm_activities
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.crm_opportunities (
  id                  uuid                     DEFAULT gen_random_uuid() NOT NULL,
  customer_id         uuid                     NOT NULL,
  title               text                     NOT NULL,
  stage               text                     DEFAULT 'yeni'::text NOT NULL,
  amount              numeric(12,2),
  expected_close_date date,
  sales_rep_id        uuid,
  notes               text,
  created_by          uuid,
  created_at          timestamp with time zone DEFAULT now() NOT NULL,
  updated_at          timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.crm_opportunities IS 'Teklif/fırsat kayıtları — satış hunisi aşaması (stage) ile takip edilir';

ALTER TABLE public.crm_opportunities
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_opportunities
  ADD CONSTRAINT crm_opportunities_pkey PRIMARY KEY (id);

ALTER TABLE public.crm_opportunities
  ADD CONSTRAINT crm_opportunities_stage_check CHECK (stage = ANY (ARRAY['yeni'::text, 'teklif'::text, 'muzakere'::text, 'kazanildi'::text, 'kaybedildi'::text]));

GRANT ALL ON public.crm_opportunities TO anon;

GRANT ALL ON public.crm_opportunities TO authenticated;

GRANT ALL ON public.crm_opportunities TO service_role;

CREATE INDEX crm_opportunities_stage_idx ON public.crm_opportunities (stage);

CREATE INDEX crm_opportunities_customer_idx ON public.crm_opportunities (customer_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.crm_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY crm_opportunities_all_staff ON public.crm_opportunities
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.customer_pending_products (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  customer_id  uuid                     NOT NULL,
  product_name text                     NOT NULL,
  quantity     integer                  DEFAULT 1 NOT NULL,
  unit_price   numeric(10,2)            DEFAULT 0 NOT NULL,
  note         text,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.customer_pending_products IS 'Doktora götürülen/satılan ama henüz eksik olan (teslim edilmemiş) ürünler';

ALTER TABLE public.customer_pending_products
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_pending_products
  ADD CONSTRAINT customer_pending_products_pkey PRIMARY KEY (id);

GRANT ALL ON public.customer_pending_products TO anon;

GRANT ALL ON public.customer_pending_products TO authenticated;

GRANT ALL ON public.customer_pending_products TO service_role;

CREATE INDEX customer_pending_products_customer_idx ON public.customer_pending_products (customer_id);

CREATE POLICY customer_pending_products_all_staff ON public.customer_pending_products
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.customer_revenue_targets (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  customer_id    uuid                     NOT NULL,
  year           integer                  NOT NULL,
  month          integer                  NOT NULL,
  target_revenue numeric(12,2)            DEFAULT 0 NOT NULL,
  created_by     uuid,
  created_at     timestamp with time zone DEFAULT now() NOT NULL,
  updated_at     timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.customer_revenue_targets IS 'Doktor/cari bazında aylık ciro hedefi — Cari Kart''ta ilerleme çubuğu olarak gösterilir';

ALTER TABLE public.customer_revenue_targets
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_revenue_targets
  ADD CONSTRAINT customer_revenue_targets_customer_id_year_month_key UNIQUE (customer_id, year, month);

ALTER TABLE public.customer_revenue_targets
  ADD CONSTRAINT customer_revenue_targets_month_check CHECK (month >= 1 AND month <= 12);

ALTER TABLE public.customer_revenue_targets
  ADD CONSTRAINT customer_revenue_targets_pkey PRIMARY KEY (id);

GRANT ALL ON public.customer_revenue_targets TO anon;

GRANT ALL ON public.customer_revenue_targets TO authenticated;

GRANT ALL ON public.customer_revenue_targets TO service_role;

CREATE INDEX customer_revenue_targets_customer_idx ON public.customer_revenue_targets (customer_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.customer_revenue_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY customer_revenue_targets_all_staff ON public.customer_revenue_targets
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.customers (
  id                       uuid                     DEFAULT gen_random_uuid() NOT NULL,
  full_name                text                     NOT NULL,
  phone                    text                     NOT NULL,
  email                    text,
  birth_date               date,
  notes                    text,
  tags                     text[]                   DEFAULT '{}'::text[] NOT NULL,
  created_by               uuid,
  created_at               timestamp with time zone DEFAULT now() NOT NULL,
  updated_at               timestamp with time zone DEFAULT now() NOT NULL,
  is_invoiced              boolean                  DEFAULT false NOT NULL,
  doctor_type              text                     DEFAULT 'sahis'::text NOT NULL,
  province                 text,
  hospital_name            text,
  next_payment_due         date,
  total_debt               numeric(10,2),
  tc_no                    text,
  address                  text,
  tax_number               text,
  vat_rate                 numeric(5,2),
  preferred_payment_method text,
  specialty                text,
  clinic_id                uuid,
  mobile_phone             text,
  whatsapp_phone           text,
  website                  text,
  instagram                text,
  district                 text,
  tax_office               text,
  assistant_info           text,
  secretary_info           text,
  referrer                 text,
  sales_rep_id             uuid,
  region_id                uuid,
  is_active                boolean                  DEFAULT true NOT NULL,
  photo_url                text,
  doctor_code              text,
  sample_monthly_quota     integer,
  sample_yearly_quota      integer,
  is_vip                   boolean                  DEFAULT false NOT NULL,
  latitude                 numeric(9,6),
  longitude                numeric(9,6),
  geocoded_at              timestamp with time zone
);

COMMENT ON COLUMN public.customers.doctor_type IS 'sahis: şahıs doktor, hastane: hastane bünyesinde çalışan doktor';

COMMENT ON COLUMN public.customers.province IS 'Doktorun bulunduğu il';

COMMENT ON COLUMN public.customers.hospital_name IS 'doctor_type = hastane ise bağlı olduğu hastane adı';

COMMENT ON COLUMN public.customers.next_payment_due IS 'Opsiyonel: doktorun bir sonraki ödeme vadesi tarihi';

COMMENT ON COLUMN public.customers.total_debt IS 'Opsiyonel: doktorla anlaşılan toplam tutar/borç — kalan tahsilat bundan hesaplanır';

COMMENT ON COLUMN public.customers.tc_no IS 'Opsiyonel: doktorun TC Kimlik Numarası';

COMMENT ON COLUMN public.customers.address IS 'Opsiyonel: doktorun/hastanenin fatura adresi';

COMMENT ON COLUMN public.customers.tax_number IS 'Opsiyonel: vergi numarası';

COMMENT ON COLUMN public.customers.vat_rate IS 'Opsiyonel: KDV oranı (%)';

COMMENT ON COLUMN public.customers.preferred_payment_method IS 'Opsiyonel: tercih edilen ödeme şekli (nakit/kredi_karti/havale)';

COMMENT ON COLUMN public.customers.latitude IS 'Opsiyonel: adres geocode edilerek önbelleğe alınmış enlem (mobil Harita/Rota Planlama)';

COMMENT ON COLUMN public.customers.longitude IS 'Opsiyonel: adres geocode edilerek önbelleğe alınmış boylam (mobil Harita/Rota Planlama)';

COMMENT ON COLUMN public.customers.geocoded_at IS 'Opsiyonel: latitude/longitude en son ne zaman hesaplandı — adres değişince yeniden geocode tetiklemek için';

ALTER TABLE public.customers
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE SET NULL;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_doctor_code_key UNIQUE (doctor_code);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_doctor_type_check CHECK (doctor_type = ANY (ARRAY['sahis'::text, 'hastane'::text]));

ALTER TABLE public.customers
  ADD CONSTRAINT customers_pkey PRIMARY KEY (id);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.competitor_reports
  ADD CONSTRAINT competitor_reports_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.crm_activities
  ADD CONSTRAINT crm_activities_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.crm_opportunities
  ADD CONSTRAINT crm_opportunities_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.customer_pending_products
  ADD CONSTRAINT customer_pending_products_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.customer_revenue_targets
  ADD CONSTRAINT customer_revenue_targets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_preferred_payment_method_check
    CHECK (preferred_payment_method IS NULL OR (preferred_payment_method = ANY (ARRAY['nakit'::text, 'kredi_karti'::text, 'havale'::text, 'pos'::text])));

GRANT ALL ON public.customers TO anon;

GRANT ALL ON public.customers TO authenticated;

GRANT ALL ON public.customers TO service_role;

CREATE INDEX customers_phone_idx ON public.customers (phone);

CREATE INDEX customers_full_name_idx ON public.customers USING gin (to_tsvector('simple'::regconfig, full_name));

CREATE TRIGGER set_doctor_code
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_doctor_code();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY customers_all_staff ON public.customers
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.doctor_visits (
  id                  uuid                     DEFAULT gen_random_uuid() NOT NULL,
  visit_date          date                     DEFAULT CURRENT_DATE NOT NULL,
  doctor_name         text                     NOT NULL,
  phone               text,
  email               text,
  social_media        text,
  notes               text,
  created_at          timestamp with time zone DEFAULT now() NOT NULL,
  updated_at          timestamp with time zone DEFAULT now() NOT NULL,
  sales_rep_id        uuid,
  customer_id         uuid,
  check_in_at         timestamp with time zone,
  check_out_at        timestamp with time zone,
  check_in_lat        numeric(9,6),
  check_in_lng        numeric(9,6),
  discussed_products  text,
  competitor_products text,
  next_visit_date     date,
  signature_data      text
);

COMMENT ON COLUMN public.doctor_visits.customer_id IS 'Opsiyonel: bu ziyaretin ilişkili olduğu cari kart (doktor_name serbest metin olarak kalmaya devam ediyor, bu FK varsa tahsilat/numune kısayolları ve doktor detayındaki Ziyaretler sekmesi bunu kullanır)';

COMMENT ON COLUMN public.doctor_visits.check_in_lat IS 'Check-in anında tarayıcı Geolocation API''sinden alınan enlem';

COMMENT ON COLUMN public.doctor_visits.check_in_lng IS 'Check-in anında tarayıcı Geolocation API''sinden alınan boylam';

COMMENT ON COLUMN public.doctor_visits.signature_data IS 'Doktorun ziyaret sırasında verdiği imza (canvas tabanlı, base64 PNG data URL)';

ALTER TABLE public.doctor_visits
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.doctor_visits
  ADD CONSTRAINT doctor_visits_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.doctor_visits
  ADD CONSTRAINT doctor_visits_pkey PRIMARY KEY (id);

GRANT ALL ON public.doctor_visits TO anon;

GRANT ALL ON public.doctor_visits TO authenticated;

GRANT ALL ON public.doctor_visits TO service_role;

CREATE INDEX doctor_visits_date_idx ON public.doctor_visits (visit_date);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.doctor_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY doctor_visits_all_staff ON public.doctor_visits
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.expenses (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  category     text                     NOT NULL,
  amount       numeric(12,2)            NOT NULL,
  description  text,
  expense_date timestamp with time zone DEFAULT now() NOT NULL,
  staff_id     uuid,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.expenses
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_amount_check CHECK (amount > 0::numeric);

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_category_check CHECK (category = ANY (ARRAY['hizmet_gideri'::text, 'diger'::text]));

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);

GRANT ALL ON public.expenses TO anon;

GRANT ALL ON public.expenses TO authenticated;

GRANT ALL ON public.expenses TO service_role;

CREATE INDEX expenses_category_idx ON public.expenses (category);

CREATE INDEX expenses_expense_date_idx ON public.expenses (expense_date DESC);

CREATE POLICY expenses_all_staff ON public.expenses
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.instagram_leads (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  full_name          text                     NOT NULL,
  phone              text,
  email              text,
  address            text,
  instagram_username text,
  notes              text,
  created_by         uuid,
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  updated_at         timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.instagram_leads
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.instagram_leads
  ADD CONSTRAINT instagram_leads_pkey PRIMARY KEY (id);

GRANT ALL ON public.instagram_leads TO anon;

GRANT ALL ON public.instagram_leads TO authenticated;

GRANT ALL ON public.instagram_leads TO service_role;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.instagram_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY instagram_leads_all_staff ON public.instagram_leads
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.invoices (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  invoice_number text                     NOT NULL,
  customer_id    uuid                     NOT NULL,
  amount         numeric(10,2)            DEFAULT 0 NOT NULL,
  issue_date     date                     DEFAULT CURRENT_DATE NOT NULL,
  note           text,
  created_by     uuid,
  created_at     timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.invoices IS 'Satışlar bölümünde tutulan basit iç fatura kayıtları';

ALTER TABLE public.invoices
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);

GRANT ALL ON public.invoices TO anon;

GRANT ALL ON public.invoices TO authenticated;

GRANT ALL ON public.invoices TO service_role;

CREATE INDEX invoices_issue_date_idx ON public.invoices (issue_date);

CREATE INDEX invoices_customer_idx ON public.invoices (customer_id);

CREATE POLICY invoices_all_staff ON public.invoices
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.payment_installment_plans (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  customer_id       uuid                     NOT NULL,
  total_amount      numeric(12,2)            NOT NULL,
  installment_count integer                  NOT NULL,
  late_fee_rate     numeric(5,2)             DEFAULT 0 NOT NULL,
  description       text,
  created_by        uuid,
  created_at        timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.payment_installment_plans IS 'Parçalı tahsilat planı başlığı — vade/gecikme faizi oranı burada, taksitler payment_installments''te';

ALTER TABLE public.payment_installment_plans
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payment_installment_plans
  ADD CONSTRAINT payment_installment_plans_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.payment_installment_plans
  ADD CONSTRAINT payment_installment_plans_installment_count_check CHECK (installment_count > 0);

ALTER TABLE public.payment_installment_plans
  ADD CONSTRAINT payment_installment_plans_pkey PRIMARY KEY (id);

ALTER TABLE public.payment_installment_plans
  ADD CONSTRAINT payment_installment_plans_total_amount_check CHECK (total_amount > 0::numeric);

GRANT ALL ON public.payment_installment_plans TO anon;

GRANT ALL ON public.payment_installment_plans TO authenticated;

GRANT ALL ON public.payment_installment_plans TO service_role;

CREATE INDEX payment_installment_plans_customer_idx ON public.payment_installment_plans (customer_id);

CREATE POLICY payment_installment_plans_all_staff ON public.payment_installment_plans
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.payment_installments (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  plan_id         uuid                     NOT NULL,
  installment_no  integer                  NOT NULL,
  due_date        date                     NOT NULL,
  amount          numeric(12,2)            NOT NULL,
  paid_payment_id uuid,
  created_at      timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.payment_installments IS 'Bir taksidin vadesi/tutarı; paid_payment_id doluysa tahsil edilmiştir';

ALTER TABLE public.payment_installments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payment_installments
  ADD CONSTRAINT payment_installments_amount_check CHECK (amount > 0::numeric);

ALTER TABLE public.payment_installments
  ADD CONSTRAINT payment_installments_pkey PRIMARY KEY (id);

ALTER TABLE public.payment_installments
  ADD CONSTRAINT payment_installments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.payment_installment_plans(id) ON DELETE CASCADE;

GRANT ALL ON public.payment_installments TO anon;

GRANT ALL ON public.payment_installments TO authenticated;

GRANT ALL ON public.payment_installments TO service_role;

CREATE INDEX payment_installments_due_date_idx ON public.payment_installments (due_date);

CREATE INDEX payment_installments_plan_idx ON public.payment_installments (plan_id);

CREATE POLICY payment_installments_all_staff ON public.payment_installments
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.payments (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  customer_id       uuid                     NOT NULL,
  amount            numeric(10,2)            NOT NULL,
  currency          text                     DEFAULT 'TRY'::text NOT NULL,
  payment_method    text                     DEFAULT 'nakit'::text NOT NULL,
  description       text,
  staff_id          uuid,
  paid_at           timestamp with time zone DEFAULT now() NOT NULL,
  created_at        timestamp with time zone DEFAULT now() NOT NULL,
  invoice_number    text,
  invoice_file_path text,
  sales_rep_id      uuid
);

COMMENT ON COLUMN public.payments.invoice_number IS 'Fatura numarası (varsa)';

COMMENT ON COLUMN public.payments.invoice_file_path IS 'Yüklenen fatura dosyasının Supabase Storage yolu';

COMMENT ON COLUMN public.payments.sales_rep_id IS 'Bu tahsilatı/satışı yapan satış temsilcisi';

ALTER TABLE public.payments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_amount_check CHECK (amount > 0::numeric);

ALTER TABLE public.payments
  ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_method_check CHECK (payment_method = ANY (ARRAY['nakit'::text, 'kredi_karti'::text, 'havale'::text, 'pos'::text]));

ALTER TABLE public.payments
  ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

ALTER TABLE public.payment_installments
  ADD CONSTRAINT payment_installments_paid_payment_id_fkey FOREIGN KEY (paid_payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;

GRANT ALL ON public.payments TO anon;

GRANT ALL ON public.payments TO authenticated;

GRANT ALL ON public.payments TO service_role;

CREATE INDEX payments_customer_idx ON public.payments (customer_id, paid_at DESC);

CREATE POLICY payments_all_staff ON public.payments
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.product_lots (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  product_id      uuid                     NOT NULL,
  lot_no          text,
  barcode         text,
  qr_code         text,
  production_date date,
  expiry_date     date,
  warehouse       text,
  shelf           text,
  supplier        text,
  quantity        integer                  DEFAULT 0 NOT NULL,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at      timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.product_lots IS 'Lot/parti bazlı stok takibi — bir ürünün birden çok lotu, her birinin kendi SKT/miktarı olabilir';

ALTER TABLE public.product_lots
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.product_lots
  ADD CONSTRAINT product_lots_pkey PRIMARY KEY (id);

GRANT ALL ON public.product_lots TO anon;

GRANT ALL ON public.product_lots TO authenticated;

GRANT ALL ON public.product_lots TO service_role;

CREATE INDEX product_lots_product_idx ON public.product_lots (product_id);

CREATE INDEX product_lots_expiry_idx ON public.product_lots (expiry_date);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.product_lots
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY product_lots_all_staff ON public.product_lots
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.products (
  id                       uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name                     text                     NOT NULL,
  sku                      text,
  category                 text,
  unit                     text                     DEFAULT 'adet'::text NOT NULL,
  critical_stock_threshold integer                  DEFAULT 5 NOT NULL,
  current_quantity         integer                  DEFAULT 0 NOT NULL,
  unit_cost                numeric(10,2),
  unit_price               numeric(10,2),
  is_active                boolean                  DEFAULT true NOT NULL,
  created_at               timestamp with time zone DEFAULT now() NOT NULL,
  updated_at               timestamp with time zone DEFAULT now() NOT NULL,
  campaign                 text,
  image_url                text,
  expiry_date              date,
  barcode                  text,
  brand_line               text
);

COMMENT ON COLUMN public.products.image_url IS 'Ürün küçük görsel adresi (üretici sitesinden)';

COMMENT ON COLUMN public.products.expiry_date IS 'Opsiyonel: ürünün son kullanım tarihi';

COMMENT ON COLUMN public.products.barcode IS 'Opsiyonel: ürün barkod numarası';

COMMENT ON COLUMN public.products.brand_line IS 'Opsiyonel: dermakor veya swiss ürün hattı';

ALTER TABLE public.products
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.products
  ADD CONSTRAINT products_brand_line_check CHECK (brand_line IS NULL OR (brand_line = ANY (ARRAY['dermakor'::text, 'swiss'::text])));

ALTER TABLE public.products
  ADD CONSTRAINT products_pkey PRIMARY KEY (id);

ALTER TABLE public.congress_stock_items
  ADD CONSTRAINT congress_stock_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.product_lots
  ADD CONSTRAINT product_lots_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.products
  ADD CONSTRAINT products_sku_key UNIQUE (sku);

GRANT ALL ON public.products TO anon;

GRANT ALL ON public.products TO authenticated;

GRANT ALL ON public.products TO service_role;

CREATE TRIGGER set_product_sku
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_product_sku();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY products_delete_admin ON public.products
  FOR DELETE
  USING (public.is_admin());

CREATE POLICY products_select ON public.products
  FOR SELECT
  USING (public.is_active_staff());

CREATE POLICY products_update_admin ON public.products
  FOR UPDATE
  USING (public.is_admin());

CREATE POLICY products_write_admin ON public.products
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE TABLE public.quote_items (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  quote_id     uuid                     NOT NULL,
  product_id   uuid,
  product_name text                     NOT NULL,
  quantity     integer                  DEFAULT 1 NOT NULL,
  unit_price   numeric(10,2)            DEFAULT 0 NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.quote_items IS 'Teklif kalemleri — ürün/adet/birim fiyat, toplam quotes.discount_rate ve vat_rate ile hesaplanır';

ALTER TABLE public.quote_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_pkey PRIMARY KEY (id);

ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

GRANT ALL ON public.quote_items TO anon;

GRANT ALL ON public.quote_items TO authenticated;

GRANT ALL ON public.quote_items TO service_role;

CREATE INDEX quote_items_quote_idx ON public.quote_items (quote_id);

CREATE POLICY quote_items_all_staff ON public.quote_items
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.quotes (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  quote_number  text                     NOT NULL,
  customer_id   uuid                     NOT NULL,
  status        text                     DEFAULT 'taslak'::text NOT NULL,
  valid_until   date,
  note          text,
  discount_rate numeric(5,2)             DEFAULT 0 NOT NULL,
  vat_rate      numeric(5,2)             DEFAULT 20 NOT NULL,
  sales_rep_id  uuid,
  created_by    uuid,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.quotes IS 'Doktora sunulan teklifler — kabul edilirse ayrıca sipariş (sales) olarak girilir, otomatik dönüşüm yoktur';

ALTER TABLE public.quotes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);

ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_status_check
    CHECK (status = ANY (ARRAY['taslak'::text, 'gonderildi'::text, 'goruldu'::text, 'kabul_edildi'::text, 'reddedildi'::text, 'suresi_doldu'::text]));

GRANT ALL ON public.quotes TO anon;

GRANT ALL ON public.quotes TO authenticated;

GRANT ALL ON public.quotes TO service_role;

CREATE INDEX quotes_status_idx ON public.quotes (status);

CREATE INDEX quotes_customer_idx ON public.quotes (customer_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY quotes_all_staff ON public.quotes
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.regions (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name             text                     NOT NULL,
  parent_region_id uuid,
  created_at       timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.regions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.regions
  ADD CONSTRAINT regions_pkey PRIMARY KEY (id);

ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE SET NULL;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE SET NULL;

ALTER TABLE public.regions
  ADD CONSTRAINT regions_parent_region_id_fkey FOREIGN KEY (parent_region_id) REFERENCES public.regions(id) ON DELETE SET NULL;

GRANT ALL ON public.regions TO anon;

GRANT ALL ON public.regions TO authenticated;

GRANT ALL ON public.regions TO service_role;

CREATE INDEX regions_parent_idx ON public.regions (parent_region_id);

CREATE POLICY regions_all_staff ON public.regions
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.reminders (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  title      text                     NOT NULL,
  note       text,
  due_date   date                     NOT NULL,
  is_done    boolean                  DEFAULT false NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.reminders IS 'Ödeme, kongre ve görev hatırlatmaları (Hatırlatmalar ve Ajanda modülleri)';

ALTER TABLE public.reminders
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);

GRANT ALL ON public.reminders TO anon;

GRANT ALL ON public.reminders TO authenticated;

GRANT ALL ON public.reminders TO service_role;

CREATE INDEX reminders_due_date_idx ON public.reminders (due_date);

CREATE POLICY reminders_all_staff ON public.reminders
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.sales (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  type         text                     DEFAULT 'sale'::text NOT NULL,
  customer_id  uuid                     NOT NULL,
  sales_rep_id uuid,
  product_id   uuid,
  product_name text                     NOT NULL,
  quantity     integer                  DEFAULT 1 NOT NULL,
  unit_price   numeric(10,2)            DEFAULT 0 NOT NULL,
  sale_date    date                     DEFAULT CURRENT_DATE NOT NULL,
  note         text,
  created_by   uuid,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.sales IS 'Kongre dışı genel ürün satışları ve iadeleri (doktor + satış temsilcisi bilgisiyle, stok hareketine yansır)';

ALTER TABLE public.sales
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_pkey PRIMARY KEY (id);

ALTER TABLE public.sales
  ADD CONSTRAINT sales_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE public.sales
  ADD CONSTRAINT sales_type_check CHECK (type = ANY (ARRAY['sale'::text, 'return'::text]));

GRANT ALL ON public.sales TO anon;

GRANT ALL ON public.sales TO authenticated;

GRANT ALL ON public.sales TO service_role;

CREATE INDEX sales_sale_date_idx ON public.sales (sale_date);

CREATE INDEX sales_customer_idx ON public.sales (customer_id);

CREATE POLICY sales_all_staff ON public.sales
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.sales_reps (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name            text                     NOT NULL,
  is_active       boolean                  DEFAULT true NOT NULL,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  photo_url       text,
  email           text,
  vehicle_info    text,
  license_info    text,
  hire_date       date,
  commission_rate numeric(5,2),
  salary          numeric(12,2),
  bank_info       text,
  sales_target    numeric(12,2),
  region_id       uuid
);

ALTER TABLE public.sales_reps
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sales_reps
  ADD CONSTRAINT sales_reps_pkey PRIMARY KEY (id);

ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id) ON DELETE SET NULL;

ALTER TABLE public.commission_adjustments
  ADD CONSTRAINT commission_adjustments_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id) ON DELETE CASCADE;

ALTER TABLE public.congress_participant_products
  ADD CONSTRAINT congress_participant_products_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id);

ALTER TABLE public.crm_activities
  ADD CONSTRAINT crm_activities_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id) ON DELETE SET NULL;

ALTER TABLE public.crm_opportunities
  ADD CONSTRAINT crm_opportunities_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id) ON DELETE SET NULL;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id) ON DELETE SET NULL;

ALTER TABLE public.doctor_visits
  ADD CONSTRAINT doctor_visits_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id);

ALTER TABLE public.payments
  ADD CONSTRAINT payments_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id);

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id);

ALTER TABLE public.sales_reps
  ADD CONSTRAINT sales_reps_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE SET NULL;

GRANT ALL ON public.sales_reps TO anon;

GRANT ALL ON public.sales_reps TO authenticated;

GRANT ALL ON public.sales_reps TO service_role;

CREATE POLICY sales_reps_all_staff ON public.sales_reps
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.sample_items (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  sample_request_id uuid                     NOT NULL,
  product_id        uuid                     NOT NULL,
  lot_no            text,
  expiry_date       date,
  quantity          integer                  NOT NULL,
  unit_price        numeric(10,2)            DEFAULT 0 NOT NULL,
  created_at        timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.sample_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sample_items
  ADD CONSTRAINT sample_items_pkey PRIMARY KEY (id);

ALTER TABLE public.sample_items
  ADD CONSTRAINT sample_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE public.sample_items
  ADD CONSTRAINT sample_items_quantity_check CHECK (quantity > 0);

GRANT ALL ON public.sample_items TO anon;

GRANT ALL ON public.sample_items TO authenticated;

GRANT ALL ON public.sample_items TO service_role;

CREATE INDEX sample_items_request_idx ON public.sample_items (sample_request_id);

CREATE POLICY sample_items_all_staff ON public.sample_items
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.sample_requests (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  customer_id     uuid                     NOT NULL,
  sales_rep_id    uuid,
  request_date    date                     DEFAULT CURRENT_DATE NOT NULL,
  status          text                     DEFAULT 'pending'::text NOT NULL,
  tracking_number text,
  shipped_at      date,
  delivered_at    date,
  delivered_to    text,
  note            text,
  created_by      uuid,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at      timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.sample_requests
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sample_requests
  ADD CONSTRAINT sample_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.sample_requests
  ADD CONSTRAINT sample_requests_pkey PRIMARY KEY (id);

ALTER TABLE public.sample_items
  ADD CONSTRAINT sample_items_sample_request_id_fkey FOREIGN KEY (sample_request_id) REFERENCES public.sample_requests(id) ON DELETE CASCADE;

ALTER TABLE public.sample_requests
  ADD CONSTRAINT sample_requests_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id) ON DELETE SET NULL;

ALTER TABLE public.sample_requests
  ADD CONSTRAINT sample_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'shipped'::text, 'delivered'::text]));

GRANT ALL ON public.sample_requests TO anon;

GRANT ALL ON public.sample_requests TO authenticated;

GRANT ALL ON public.sample_requests TO service_role;

CREATE INDEX sample_requests_customer_idx ON public.sample_requests (customer_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.sample_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY sample_requests_all_staff ON public.sample_requests
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.staff (
  id              uuid                     NOT NULL,
  full_name       text                     DEFAULT ''::text NOT NULL,
  role            text                     DEFAULT 'staff'::text NOT NULL,
  phone           text,
  is_active       boolean                  DEFAULT true NOT NULL,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  expo_push_token text,
  avatar_url      text,
  job_title       text,
  email           text,
  address         text,
  whatsapp_phone  text,
  social_media    text
);

COMMENT ON COLUMN public.staff.expo_push_token IS 'Expo push notification token — mobil uygulama girişte günceller, henüz sunucu taraflı push göndermek için kullanılmıyor';

COMMENT ON COLUMN public.staff.avatar_url IS 'profile-images bucket''ındaki kendi profil fotoğrafı (staff/<id>.jpg), personel Ayarlar''dan kendi yükler';

COMMENT ON COLUMN public.staff.job_title IS 'Görev/ünvan (ör. "Genel Müdür") — role (admin/staff yetki seviyesi) ile KARIŞTIRILMAMALI, sadece kartvizitte isim altında gösterilen serbest metin';

COMMENT ON COLUMN public.staff.email IS 'Kartvizitte gösterilecek iletişim e-postası (auth.users''taki giriş e-postasından bağımsız, serbest metin)';

COMMENT ON COLUMN public.staff.whatsapp_phone IS 'phone''dan farklı bir WhatsApp numarası kullanılıyorsa; boşsa kartvizit phone''u WhatsApp linki olarak kullanır';

COMMENT ON COLUMN public.staff.social_media IS 'Serbest metin, çok satırlı — her satır bir sosyal medya/site linki (Instagram, LinkedIn, web sitesi vb.), platform başına ayrı kolon açılmadı';

ALTER TABLE public.staff
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_pkey PRIMARY KEY (id);

ALTER TABLE public.ai_conversations
  ADD CONSTRAINT ai_conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.ai_usage_logs
  ADD CONSTRAINT ai_usage_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.staff(id);

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;

ALTER TABLE public.budget_targets
  ADD CONSTRAINT budget_targets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.commission_adjustments
  ADD CONSTRAINT commission_adjustments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.commission_rules
  ADD CONSTRAINT commission_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.competitor_reports
  ADD CONSTRAINT competitor_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.staff(id);

ALTER TABLE public.congress_checklist_items
  ADD CONSTRAINT congress_checklist_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.congress_consumables
  ADD CONSTRAINT congress_consumables_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.congress_stock_items
  ADD CONSTRAINT congress_stock_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.congresses
  ADD CONSTRAINT congresses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.crm_activities
  ADD CONSTRAINT crm_activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.crm_opportunities
  ADD CONSTRAINT crm_opportunities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.customer_revenue_targets
  ADD CONSTRAINT customer_revenue_targets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);

ALTER TABLE public.instagram_leads
  ADD CONSTRAINT instagram_leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.payment_installment_plans
  ADD CONSTRAINT payment_installment_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.payments
  ADD CONSTRAINT payments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.sales
  ADD CONSTRAINT sales_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.sample_requests
  ADD CONSTRAINT sample_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.staff
  ADD CONSTRAINT staff_role_check CHECK (role = ANY (ARRAY['admin'::text, 'staff'::text]));

GRANT ALL ON public.staff TO anon;

GRANT ALL ON public.staff TO authenticated;

GRANT ALL ON public.staff TO service_role;

CREATE TRIGGER staff_protect_privileged_columns
  BEFORE UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_staff_privileged_columns();

CREATE POLICY staff_select ON public.staff
  FOR SELECT
  USING ((auth.uid() IS NOT NULL));

CREATE POLICY staff_update_admin ON public.staff
  FOR UPDATE
  USING (public.is_admin());

CREATE POLICY staff_update_self ON public.staff
  FOR UPDATE
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

CREATE TABLE public.staff_ai_keys (
  staff_id          uuid                     NOT NULL,
  openai_api_key    text,
  gemini_api_key    text,
  anthropic_api_key text,
  updated_at        timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.staff_ai_keys
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff_ai_keys
  ADD CONSTRAINT staff_ai_keys_pkey PRIMARY KEY (staff_id);

ALTER TABLE public.staff_ai_keys
  ADD CONSTRAINT staff_ai_keys_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;

GRANT ALL ON public.staff_ai_keys TO anon;

GRANT ALL ON public.staff_ai_keys TO authenticated;

GRANT ALL ON public.staff_ai_keys TO service_role;

CREATE POLICY staff_ai_keys_own_delete ON public.staff_ai_keys
  FOR DELETE
  USING ((staff_id = auth.uid()));

CREATE POLICY staff_ai_keys_own_insert ON public.staff_ai_keys
  FOR INSERT
  WITH CHECK ((staff_id = auth.uid()));

CREATE POLICY staff_ai_keys_own_select ON public.staff_ai_keys
  FOR SELECT
  USING ((staff_id = auth.uid()));

CREATE POLICY staff_ai_keys_own_update ON public.staff_ai_keys
  FOR UPDATE
  USING ((staff_id = auth.uid()))
  WITH CHECK ((staff_id = auth.uid()));

CREATE TABLE public.staff_messages (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  sender_id       uuid,
  body            text,
  attachment_path text,
  attachment_name text,
  created_at      timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.staff_messages IS 'Ekip Sohbeti — tek paylaşımlı kanal, tüm aktif personel okur/yazar; düzenleme/silme yok (basit sohbet geçmişi)';

ALTER TABLE public.staff_messages
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff_messages
  ADD CONSTRAINT staff_messages_pkey PRIMARY KEY (id);

ALTER TABLE public.staff_messages
  ADD CONSTRAINT staff_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.staff(id) ON DELETE SET NULL;

GRANT ALL ON public.staff_messages TO anon;

GRANT ALL ON public.staff_messages TO authenticated;

GRANT ALL ON public.staff_messages TO service_role;

CREATE INDEX staff_messages_created_idx ON public.staff_messages (created_at DESC);

CREATE POLICY staff_messages_insert ON public.staff_messages
  FOR INSERT
  WITH CHECK ((public.is_active_staff() AND (sender_id = auth.uid())));

CREATE POLICY staff_messages_select ON public.staff_messages
  FOR SELECT
  USING (public.is_active_staff());

CREATE TABLE public.stock_count_items (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  stock_count_id    uuid                     NOT NULL,
  product_id        uuid                     NOT NULL,
  expected_quantity integer                  NOT NULL,
  counted_quantity  integer,
  note              text,
  created_at        timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.stock_count_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stock_count_items
  ADD CONSTRAINT stock_count_items_pkey PRIMARY KEY (id);

ALTER TABLE public.stock_count_items
  ADD CONSTRAINT stock_count_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE public.stock_count_items
  ADD CONSTRAINT stock_count_items_stock_count_id_product_id_key UNIQUE (stock_count_id, product_id);

GRANT ALL ON public.stock_count_items TO anon;

GRANT ALL ON public.stock_count_items TO authenticated;

GRANT ALL ON public.stock_count_items TO service_role;

CREATE INDEX stock_count_items_count_idx ON public.stock_count_items (stock_count_id);

CREATE POLICY stock_count_items_all_staff ON public.stock_count_items
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.stock_counts (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  count_date   date                     DEFAULT CURRENT_DATE NOT NULL,
  status       text                     DEFAULT 'open'::text NOT NULL,
  notes        text,
  created_by   uuid,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone
);

ALTER TABLE public.stock_counts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stock_counts
  ADD CONSTRAINT stock_counts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.stock_counts
  ADD CONSTRAINT stock_counts_pkey PRIMARY KEY (id);

ALTER TABLE public.stock_count_items
  ADD CONSTRAINT stock_count_items_stock_count_id_fkey FOREIGN KEY (stock_count_id) REFERENCES public.stock_counts(id) ON DELETE CASCADE;

ALTER TABLE public.stock_counts
  ADD CONSTRAINT stock_counts_status_check CHECK (status = ANY (ARRAY['open'::text, 'completed'::text]));

GRANT ALL ON public.stock_counts TO anon;

GRANT ALL ON public.stock_counts TO authenticated;

GRANT ALL ON public.stock_counts TO service_role;

CREATE POLICY stock_counts_all_staff ON public.stock_counts
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.stock_movements (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  product_id    uuid                     NOT NULL,
  movement_type text                     NOT NULL,
  quantity      integer                  NOT NULL,
  reason        text,
  customer_id   uuid,
  staff_id      uuid,
  note          text,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  lot_id        uuid,
  unit_price    numeric(10,2)
);

CREATE FUNCTION public.record_stock_movement (
  p_product_id    uuid,
  p_movement_type text,
  p_quantity      integer,
  p_reason        text    DEFAULT NULL::text,
  p_customer_id   uuid    DEFAULT NULL::uuid,
  p_note          text    DEFAULT NULL::text,
  p_lot_id        uuid    DEFAULT NULL::uuid,
  p_unit_price    numeric DEFAULT NULL::numeric
)
  RETURNS public.stock_movements
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_delta integer;
  v_row public.stock_movements;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  v_delta := public.stock_movement_delta(p_movement_type, p_quantity);

  insert into public.stock_movements (product_id, movement_type, quantity, reason, customer_id, staff_id, note, lot_id, unit_price)
  values (p_product_id, p_movement_type, abs(p_quantity), p_reason, p_customer_id, auth.uid(), p_note, p_lot_id, p_unit_price)
  returning * into v_row;

  update public.products
  set current_quantity = greatest(0, current_quantity + v_delta),
      updated_at = now()
  where id = p_product_id;

  if p_lot_id is not null then
    update public.product_lots
    set quantity = greatest(0, quantity + v_delta),
        updated_at = now()
    where id = p_lot_id;
  end if;

  return v_row;
end;
$function$;

GRANT ALL ON FUNCTION public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric) TO anon;

GRANT ALL ON FUNCTION public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric) TO authenticated;

GRANT ALL ON FUNCTION public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric) TO service_role;

CREATE FUNCTION public.record_stock_movement (
  p_product_id    uuid,
  p_movement_type text,
  p_quantity      integer,
  p_reason        text    DEFAULT NULL::text,
  p_customer_id   uuid    DEFAULT NULL::uuid,
  p_note          text    DEFAULT NULL::text,
  p_lot_id        uuid    DEFAULT NULL::uuid
)
  RETURNS public.stock_movements
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_delta integer;
  v_row public.stock_movements;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  v_delta := case p_movement_type
    when 'in' then p_quantity
    when 'out' then -p_quantity
    when 'sample' then -p_quantity
    when 'return' then p_quantity
    when 'disposal' then -p_quantity
    when 'adjustment' then p_quantity
    else 0
  end;

  insert into public.stock_movements (product_id, movement_type, quantity, reason, customer_id, staff_id, note, lot_id)
  values (p_product_id, p_movement_type, abs(p_quantity), p_reason, p_customer_id, auth.uid(), p_note, p_lot_id)
  returning * into v_row;

  update public.products
  set current_quantity = greatest(0, current_quantity + v_delta),
      updated_at = now()
  where id = p_product_id;

  if p_lot_id is not null then
    update public.product_lots
    set quantity = greatest(0, quantity + v_delta),
        updated_at = now()
    where id = p_lot_id;
  end if;

  return v_row;
end;
$function$;

GRANT ALL ON FUNCTION public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid) TO anon;

GRANT ALL ON FUNCTION public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.record_stock_movement(uuid, text, integer, text, uuid, text, uuid) TO service_role;

CREATE FUNCTION public.record_stock_movement (
  p_product_id    uuid,
  p_movement_type text,
  p_quantity      integer,
  p_reason        text    DEFAULT NULL::text,
  p_customer_id   uuid    DEFAULT NULL::uuid,
  p_note          text    DEFAULT NULL::text
)
  RETURNS public.stock_movements
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_delta integer;
  v_row public.stock_movements;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  v_delta := case p_movement_type
    when 'in' then p_quantity
    when 'out' then -p_quantity
    when 'sample' then -p_quantity
    when 'adjustment' then p_quantity
    else 0
  end;

  insert into public.stock_movements (product_id, movement_type, quantity, reason, customer_id, staff_id, note)
  values (p_product_id, p_movement_type, abs(p_quantity), p_reason, p_customer_id, auth.uid(), p_note)
  returning * into v_row;

  update public.products
  set current_quantity = greatest(0, current_quantity + v_delta),
      updated_at = now()
  where id = p_product_id;

  return v_row;
end;
$function$;

GRANT ALL ON FUNCTION public.record_stock_movement(uuid, text, integer, text, uuid, text) TO anon;

GRANT ALL ON FUNCTION public.record_stock_movement(uuid, text, integer, text, uuid, text) TO authenticated;

GRANT ALL ON FUNCTION public.record_stock_movement(uuid, text, integer, text, uuid, text) TO service_role;

CREATE FUNCTION public.update_stock_movement (
  p_movement_id   uuid,
  p_movement_type text,
  p_quantity      integer,
  p_reason        text    DEFAULT NULL::text,
  p_customer_id   uuid    DEFAULT NULL::uuid,
  p_note          text    DEFAULT NULL::text,
  p_lot_id        uuid    DEFAULT NULL::uuid,
  p_unit_price    numeric DEFAULT NULL::numeric
)
  RETURNS public.stock_movements
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_old public.stock_movements;
  v_old_delta integer;
  v_new_delta integer;
  v_row public.stock_movements;
begin
  if not public.is_active_staff() then
    raise exception 'Yetkisiz işlem';
  end if;

  select * into v_old from public.stock_movements where id = p_movement_id;
  if not found then
    raise exception 'Hareket bulunamadı';
  end if;

  v_old_delta := public.stock_movement_delta(v_old.movement_type, v_old.quantity);
  v_new_delta := public.stock_movement_delta(p_movement_type, abs(p_quantity));

  update public.products
  set current_quantity = greatest(0, current_quantity - v_old_delta + v_new_delta),
      updated_at = now()
  where id = v_old.product_id;

  -- Eski ve yeni lot AYNIYSA tek update'te birleştirilmeli — ayrı ayrı
  -- (önce eski etkiyi çıkar, sonra yeni etkiyi ekle) yapılırsa aradaki greatest(0,...)
  -- taban değeri erken sıfıra kırpıp asıl (- eski + yeni) toplamının negatif
  -- ara sonucunu kalıcı olarak kaybedebilir (örn. lot 2 iken 10 birimlik bir
  -- hareket 3'e düşürülürse: ayrı adımlarda greatest(0,2-10)=0 sonra 0+3=3,
  -- oysa doğrusu greatest(0,2-10+3)=0).
  if v_old.lot_id is not null and v_old.lot_id = p_lot_id then
    update public.product_lots
    set quantity = greatest(0, quantity - v_old_delta + v_new_delta),
        updated_at = now()
    where id = p_lot_id;
  else
    if v_old.lot_id is not null then
      update public.product_lots
      set quantity = greatest(0, quantity - v_old_delta),
          updated_at = now()
      where id = v_old.lot_id;
    end if;
    if p_lot_id is not null then
      update public.product_lots
      set quantity = greatest(0, quantity + v_new_delta),
          updated_at = now()
      where id = p_lot_id;
    end if;
  end if;

  update public.stock_movements
  set movement_type = p_movement_type,
      quantity = abs(p_quantity),
      reason = p_reason,
      customer_id = p_customer_id,
      note = p_note,
      lot_id = p_lot_id,
      unit_price = p_unit_price
  where id = p_movement_id
  returning * into v_row;

  return v_row;
end;
$function$;

GRANT ALL ON FUNCTION public.update_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric) TO anon;

GRANT ALL ON FUNCTION public.update_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric) TO authenticated;

GRANT ALL ON FUNCTION public.update_stock_movement(uuid, text, integer, text, uuid, text, uuid, numeric) TO service_role;

COMMENT ON COLUMN public.stock_movements.lot_id IS 'Bu hareketin ilişkili olduğu lot (opsiyonel — lot takibi yapılmayan ürünlerde boş kalır)';

COMMENT ON COLUMN public.stock_movements.unit_price IS 'Opsiyonel: bu hareketin birim fiyatı — satış/numune otomatik dolduruyor, elle hareketlerde manuel girilebilir';

ALTER TABLE public.stock_movements
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.product_lots(id) ON DELETE SET NULL;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check
    CHECK (movement_type = ANY (ARRAY['in'::text, 'out'::text, 'adjustment'::text, 'sample'::text, 'return'::text, 'disposal'::text]));

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_quantity_check CHECK (quantity > 0);

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);

GRANT ALL ON public.stock_movements TO anon;

GRANT ALL ON public.stock_movements TO authenticated;

GRANT ALL ON public.stock_movements TO service_role;

CREATE INDEX stock_movements_product_idx ON public.stock_movements (product_id, created_at DESC);

CREATE POLICY stock_movements_all_staff ON public.stock_movements
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.tasks (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  title        text                     NOT NULL,
  description  text,
  status       text                     DEFAULT 'bekliyor'::text NOT NULL,
  priority     text                     DEFAULT 'normal'::text NOT NULL,
  due_date     date,
  assigned_to  uuid,
  customer_id  uuid,
  completed_at timestamp with time zone,
  created_by   uuid,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.tasks IS 'Görev Yönetimi — personele atanabilen, durum/öncelik taşıyan genel iş kalemleri';

ALTER TABLE public.tasks
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.staff(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_priority_check CHECK (priority = ANY (ARRAY['dusuk'::text, 'normal'::text, 'yuksek'::text]));

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check CHECK (status = ANY (ARRAY['bekliyor'::text, 'devam_ediyor'::text, 'tamamlandi'::text, 'iptal'::text]));

GRANT ALL ON public.tasks TO anon;

GRANT ALL ON public.tasks TO authenticated;

GRANT ALL ON public.tasks TO service_role;

CREATE INDEX tasks_due_date_idx ON public.tasks (due_date);

CREATE INDEX tasks_assigned_to_idx ON public.tasks (assigned_to);

CREATE INDEX tasks_status_idx ON public.tasks (status);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY tasks_all_staff ON public.tasks
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.vehicle_fuel_logs (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id uuid                     NOT NULL,
  fill_date  date                     DEFAULT CURRENT_DATE NOT NULL,
  amount     numeric(10,2)            NOT NULL,
  note       text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.vehicle_fuel_logs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_fuel_logs
  ADD CONSTRAINT vehicle_fuel_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.vehicle_fuel_logs
  ADD CONSTRAINT vehicle_fuel_logs_pkey PRIMARY KEY (id);

GRANT ALL ON public.vehicle_fuel_logs TO anon;

GRANT ALL ON public.vehicle_fuel_logs TO authenticated;

GRANT ALL ON public.vehicle_fuel_logs TO service_role;

CREATE POLICY vehicle_fuel_logs_all_staff ON public.vehicle_fuel_logs
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.vehicles (
  id                   uuid                     DEFAULT gen_random_uuid() NOT NULL,
  brand_model          text                     NOT NULL,
  year                 integer,
  plate_number         text,
  registration_info    text,
  vendor_company       text,
  sales_rep_id         uuid,
  monthly_rental_price numeric(10,2),
  maintenance_date     date,
  has_utts             boolean                  DEFAULT false NOT NULL,
  notes                text,
  created_by           uuid,
  created_at           timestamp with time zone DEFAULT now() NOT NULL,
  updated_at           timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.vehicles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);

ALTER TABLE public.vehicle_fuel_logs
  ADD CONSTRAINT vehicle_fuel_logs_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id) ON DELETE SET NULL;

GRANT ALL ON public.vehicles TO anon;

GRANT ALL ON public.vehicles TO authenticated;

GRANT ALL ON public.vehicles TO service_role;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY vehicles_all_staff ON public.vehicles
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

CREATE TABLE public.visit_plans (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  customer_id       uuid                     NOT NULL,
  assigned_staff_id uuid,
  planned_date      date                     NOT NULL,
  note              text,
  status            text                     DEFAULT 'bekliyor'::text NOT NULL,
  created_by        uuid,
  created_at        timestamp with time zone DEFAULT now() NOT NULL,
  updated_at        timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.visit_plans IS 'Admin''in personele atadığı haftalık ziyaret planı — sadece admin yazabilir, atanan personel dahil tüm aktif personel okuyabilir';

ALTER TABLE public.visit_plans
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.visit_plans
  ADD CONSTRAINT visit_plans_assigned_staff_id_fkey FOREIGN KEY (assigned_staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;

ALTER TABLE public.visit_plans
  ADD CONSTRAINT visit_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE public.visit_plans
  ADD CONSTRAINT visit_plans_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.visit_plans
  ADD CONSTRAINT visit_plans_pkey PRIMARY KEY (id);

ALTER TABLE public.visit_plans
  ADD CONSTRAINT visit_plans_status_check CHECK (status = ANY (ARRAY['bekliyor'::text, 'tamamlandi'::text, 'iptal'::text]));

GRANT ALL ON public.visit_plans TO anon;

GRANT ALL ON public.visit_plans TO authenticated;

GRANT ALL ON public.visit_plans TO service_role;

CREATE INDEX visit_plans_date_idx ON public.visit_plans (planned_date);

CREATE INDEX visit_plans_staff_idx ON public.visit_plans (assigned_staff_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.visit_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY visit_plans_admin_write ON public.visit_plans
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY visit_plans_select ON public.visit_plans
  FOR SELECT
  USING (public.is_active_staff());

CREATE TABLE public.whatsapp_templates (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name       text                     NOT NULL,
  body       text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.whatsapp_templates
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsapp_templates
  ADD CONSTRAINT whatsapp_templates_pkey PRIMARY KEY (id);

GRANT ALL ON public.whatsapp_templates TO anon;

GRANT ALL ON public.whatsapp_templates TO authenticated;

GRANT ALL ON public.whatsapp_templates TO service_role;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY wa_templates_delete_admin ON public.whatsapp_templates
  FOR DELETE
  USING (public.is_admin());

CREATE POLICY wa_templates_select ON public.whatsapp_templates
  FOR SELECT
  USING (public.is_active_staff());

CREATE POLICY wa_templates_update_admin ON public.whatsapp_templates
  FOR UPDATE
  USING (public.is_admin());

CREATE POLICY wa_templates_write_admin ON public.whatsapp_templates
  FOR INSERT
  WITH CHECK (public.is_admin());
