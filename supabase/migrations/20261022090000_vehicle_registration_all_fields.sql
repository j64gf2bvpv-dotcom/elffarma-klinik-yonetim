-- Araçlar: ruhsattaki TÜM alanlar (kullanıcı isteği, 2026-10-22: "ruhsatta ne
-- yazıyorsa detaylı baksın, hepsini doğru girsin, sadece buradaki bilgiler olsun").
-- Önceki migration'daki alanlara ek olarak ruhsatın kalan kutuları. Hepsi metin —
-- ruhsatta yazdığı gibi saklanır ("1186", "e19*2018/858*00001*00").

alter table public.vehicles
  add column if not exists issued_place text,              -- Y.1 verildiği il / ilçe
  add column if not exists registration_sequence_no text,  -- Y.2 tescil sıra no
  add column if not exists model_type text,                -- D.2 tipi
  add column if not exists net_weight text,                -- G.1 net ağırlığı (kg)
  add column if not exists max_laden_weight text,          -- F.1 azami yüklü ağırlığı (kg)
  add column if not exists train_weight text,              -- G katar ağırlığı (kg)
  add column if not exists trailer_max_weight text,        -- G.2 römork azami yüklü ağırlığı (kg)
  add column if not exists standing_capacity text,         -- S.2 ayakta yolcu sayısı
  add column if not exists power_weight_ratio text,        -- Q güç ağırlık oranı (motosiklet)
  add column if not exists type_approval_no text,          -- K tip onay no
  add column if not exists rights_holders text,            -- Z.1 araç üzerinde hak ve menfaati bulunanlar
  add column if not exists notary_sale_date text,          -- Z.3.1 noter satış tarihi
  add column if not exists notary_sale_no text,            -- Z.3.2 noter satış no
  add column if not exists notary_name text,               -- Z.3.3 noterin adı
  add column if not exists other_info text;                -- Z.2 diğer bilgiler
