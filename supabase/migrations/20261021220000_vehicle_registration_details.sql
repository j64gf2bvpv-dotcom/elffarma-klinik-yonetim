-- Araçlar: ruhsat (Araç Tescil Belgesi) bilgileri + ruhsat fotoğrafı
-- (kullanıcı isteği, 2026-10-21: "araçlar kısmına ruhsat bilgileri kısmını koy,
-- ruhsatın resmini ekle kısmı olsun, ekleyince bütün bilgiler eklensin").
-- Fotoğraf private 'documents' bucket'ında (vehicles/... yolu) — ruhsat kişisel
-- veri içerdiği için public değil, imzalı URL ile gösterilir. Alanlar ruhsattaki
-- kodlara karşılık gelir; fotoğraftan yapay zekâ ile okunup doldurulur, elle de
-- düzeltilebilir. Mevcut plate_number (A), brand_model (D.1 + D.3), year (model
-- yılı) aynen kullanılır.

alter table public.vehicles
  add column if not exists registration_image_path text,
  add column if not exists owner_name text,               -- C.1.1 + C.1.2 soyadı/ünvan + adı
  add column if not exists owner_tax_id text,             -- Y.1 T.C. kimlik / vergi no
  add column if not exists owner_address text,            -- C.1.3 adres
  add column if not exists chassis_number text,           -- E şase no
  add column if not exists engine_number text,            -- P.5 motor no
  add column if not exists first_registration_date date,  -- B ilk tescil tarihi
  add column if not exists registration_date date,        -- I tescil tarihi
  add column if not exists vehicle_class text,            -- J araç sınıfı
  add column if not exists vehicle_type text,             -- D.5 cinsi (otomobil, kamyonet…)
  add column if not exists color text,                    -- R rengi
  add column if not exists fuel_type text,                -- P.3 yakıt cinsi
  add column if not exists engine_capacity text,          -- P.1 silindir hacmi
  add column if not exists engine_power text,             -- P.2 motor gücü
  add column if not exists seat_count integer,            -- S.1 koltuk sayısı
  add column if not exists usage_purpose text,            -- Z.1 kullanım amacı
  add column if not exists document_serial text,          -- belge seri no
  add column if not exists inspection_valid_until date;   -- muayene geçerlilik tarihi
