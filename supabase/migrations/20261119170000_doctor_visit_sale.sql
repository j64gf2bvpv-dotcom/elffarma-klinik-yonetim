-- Ziyarette satılan ürünler (kullanıcı isteği, 2026-11-19: WhatsApp sohbetinden "hangi doktora hangi ürün ne
-- kadara satıldı" günlük işlensin, doktorun adı/telefonu altında görünsün). Biçim:
-- {"items":[{"text":"5 paket Bvrs pl","amount":35000}],"total":175000}
alter table public.doctor_visits add column if not exists sale jsonb;
