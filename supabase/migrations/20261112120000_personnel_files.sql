-- Personel Özlük Dosyası (kullanıcı isteği, 2026-11-12: "personel özlük dosyası bölümü olması
-- gerekli, personel evraklarının bilgilerini oraya koymam gerekli"). Programa giriş yapan
-- kullanıcılardan (staff) bağımsız: her çalışan için kimlik/iletişim/iş bilgileri + evraklar.
-- T.C. no, IBAN gibi hassas bilgiler olduğundan SADECE YÖNETİCİLER okur/yazar (is_admin()) —
-- uygulamanın genel "tüm personel her şeyi görür" modelinden bilerek ayrılıyor.
create table if not exists public.personnel (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  tc_no text,
  birth_date date,
  birth_place text,
  gender text,
  marital_status text,
  blood_type text,
  phone text,
  email text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  position text,
  department text,
  start_date date,
  end_date date,
  sgk_no text,
  iban text,
  education text,
  military_status text,
  license_class text,
  photo_path text,
  notes text,
  created_by uuid references public.staff (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personnel_documents (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel (id) on delete cascade,
  -- Standart özlük evrakı anahtarı (ör. 'nufus_cuzdani') ya da 'diger'
  doc_type text not null,
  title text,
  document_date date,
  valid_until date,
  attachment_paths text[] not null default '{}',
  note text,
  created_by uuid references public.staff (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personnel_documents_personnel_idx on public.personnel_documents (personnel_id);

drop trigger if exists set_updated_at on public.personnel;
create trigger set_updated_at before update on public.personnel
for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.personnel_documents;
create trigger set_updated_at before update on public.personnel_documents
for each row execute function public.set_updated_at();

alter table public.personnel enable row level security;
alter table public.personnel_documents enable row level security;

drop policy if exists "personnel_admin_all" on public.personnel;
create policy "personnel_admin_all" on public.personnel for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "personnel_documents_admin_all" on public.personnel_documents;
create policy "personnel_documents_admin_all" on public.personnel_documents for all
  using (public.is_admin()) with check (public.is_admin());
