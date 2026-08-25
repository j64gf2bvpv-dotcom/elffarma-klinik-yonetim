-- Kullanıcı isteğiyle (2026-08-25): "yapay zeka kısmı tüm kullanıcılarda
-- çalışmalı hata vermemeli" — önceden bir bulut sağlayıcı (OpenAI/Gemini/
-- Anthropic) API anahtarının tek kaynağı ya kişiye özel staff_ai_keys
-- (staff_id = auth.uid() ile kilitli) ya da paket zamanında gömülen .env
-- idi; ikisi de yoksa (bu ERP'nin tipik personeli kendi API anahtarını
-- almaz/ödemez) yapay zekâ her staff girişinde hata veriyordu. Bu, tek
-- satırlık bir "paylaşılan anahtar" tablosu — sadece yönetici yazabilir,
-- herhangi bir aktif personel okuyabilir (istemci tarafından doğrudan API
-- çağrısı yapmak için ham değeri okuması gerekiyor — bu uygulamanın ayrı bir
-- backend'i yok). staff_ai_keys'in "sır bu yüzden shared-trust kullanma"
-- kuralından BİLİNÇLİ bir sapma — burada amaç zaten paylaşmak.
create table public.ai_shared_keys (
  id boolean primary key default true,
  openai_api_key text,
  gemini_api_key text,
  anthropic_api_key text,
  updated_at timestamptz not null default now(),
  constraint ai_shared_keys_singleton check (id)
);

alter table public.ai_shared_keys enable row level security;

create policy ai_shared_keys_staff_select on public.ai_shared_keys
  for select using (public.is_active_staff());

create policy ai_shared_keys_admin_write on public.ai_shared_keys
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.ai_shared_keys to authenticated;
grant insert, update, delete on public.ai_shared_keys to authenticated;
