/**
 * Araç marka / model listesi — Araçlar formunda aranabilir seçim için
 * (kullanıcı isteği, 2026-10-21: "araç model kısmında tüm modeller olsun,
 * onlar arasında seçim yapalım"). Türkiye'de satılan / yaygın binek ve hafif
 * ticari modeller; listede olmayan model yine elle yazılabilir.
 */
export const CAR_MODELS: Record<string, string[]> = {
  'Alfa Romeo': ['Giulia', 'Stelvio', 'Tonale', 'Junior', 'Giulietta', 'MiTo'],
  Audi: ['A1', 'A3', 'A3 Sedan', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q3 Sportback', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'e-tron GT', 'TT'],
  BMW: ['1 Serisi', '2 Serisi', '2 Serisi Active Tourer', '3 Serisi', '4 Serisi', '5 Serisi', '7 Serisi', '8 Serisi', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'iX', 'iX1', 'iX3', 'i4', 'i5', 'i7', 'Z4'],
  BYD: ['Atto 2', 'Atto 3', 'Dolphin', 'Seal', 'Seal U', 'Seal U DM-i', 'Sealion 7', 'Han', 'Tang'],
  Chery: ['Tiggo 4', 'Tiggo 7', 'Tiggo 7 Pro', 'Tiggo 8', 'Tiggo 8 Pro', 'Omoda 5', 'Omoda E5'],
  Chevrolet: ['Aveo', 'Cruze', 'Captiva', 'Spark', 'Trax'],
  Citroën: ['C3', 'C3 Aircross', 'C4', 'C4 X', 'C5 Aircross', 'C5 X', 'C-Elysée', 'Berlingo', 'Jumpy', 'Jumper', 'ë-C4', 'Ami'],
  Cupra: ['Born', 'Formentor', 'Leon', 'Ateca', 'Tavascan', 'Terramar'],
  Dacia: ['Sandero', 'Sandero Stepway', 'Logan', 'Jogger', 'Duster', 'Bigster', 'Spring', 'Lodgy', 'Dokker'],
  DS: ['DS 3', 'DS 4', 'DS 7', 'DS 9'],
  Fiat: ['Egea', 'Egea Cross', 'Egea Sedan', 'Egea Hatchback', 'Egea Station Wagon', '500', '500X', '500L', '600', 'Panda', 'Tipo', 'Topolino', 'Doblo', 'Fiorino', 'Scudo', 'Ducato', 'Linea'],
  Ford: ['Fiesta', 'Focus', 'Puma', 'Kuga', 'Mustang', 'Mustang Mach-E', 'Explorer', 'Ranger', 'Tourneo Courier', 'Tourneo Connect', 'Tourneo Custom', 'Transit Courier', 'Transit Connect', 'Transit Custom', 'Transit'],
  Honda: ['City', 'Civic', 'Civic Sedan', 'HR-V', 'CR-V', 'ZR-V', 'Jazz', 'e:Ny1'],
  Hyundai: ['i10', 'i20', 'i30', 'Bayon', 'Kona', 'Kona Electric', 'Tucson', 'Santa Fe', 'Elantra', 'IONIQ 5', 'IONIQ 6', 'Accent Blue', 'Staria'],
  Isuzu: ['D-Max'],
  Jaguar: ['E-Pace', 'F-Pace', 'I-Pace', 'XE', 'XF'],
  Jeep: ['Avenger', 'Renegade', 'Compass', 'Grand Cherokee', 'Wrangler'],
  Kia: ['Picanto', 'Rio', 'Stonic', 'Ceed', 'XCeed', 'Niro', 'Sportage', 'Sorento', 'EV3', 'EV6', 'EV9'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Sport', 'Range Rover Velar', 'Range Rover Evoque'],
  Lexus: ['UX', 'NX', 'RX', 'LBX', 'ES', 'LS'],
  Mazda: ['Mazda2', 'Mazda3', 'CX-3', 'CX-30', 'CX-5', 'CX-60', 'MX-5'],
  'Mercedes-Benz': ['A Serisi', 'A Serisi Sedan', 'B Serisi', 'C Serisi', 'CLA', 'CLE', 'E Serisi', 'S Serisi', 'GLA', 'GLB', 'GLC', 'GLC Coupé', 'GLE', 'GLS', 'G Serisi', 'EQA', 'EQB', 'EQE', 'EQS', 'Vito', 'V Serisi', 'Sprinter', 'Citan'],
  MG: ['MG3', 'MG4', 'MG5', 'ZS', 'HS', 'Marvel R', 'Cyberster'],
  Mini: ['Cooper', 'Countryman', 'Aceman', 'Clubman', 'Cabrio'],
  Mitsubishi: ['ASX', 'Eclipse Cross', 'L200', 'Outlander', 'Space Star'],
  Nissan: ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Ariya', 'Leaf', 'Navara', 'Townstar'],
  Opel: ['Corsa', 'Astra', 'Astra Sports Tourer', 'Mokka', 'Crossland', 'Grandland', 'Frontera', 'Insignia', 'Combo', 'Vivaro', 'Movano', 'Zafira Life'],
  Peugeot: ['208', '2008', '308', '308 SW', '3008', '408', '508', '5008', 'Rifter', 'Partner', 'Expert', 'Boxer', '301'],
  Porsche: ['718 Cayman', '718 Boxster', '911', 'Macan', 'Cayenne', 'Panamera', 'Taycan'],
  Renault: ['Clio', 'Megane', 'Megane Sedan', 'Megane E-Tech', 'Taliant', 'Captur', 'Austral', 'Symbioz', 'Rafale', 'Kadjar', 'Koleos', 'Zoe', 'Scenic E-Tech', 'Kangoo', 'Trafic', 'Master', 'Fluence', 'Symbol'],
  Seat: ['Ibiza', 'Leon', 'Arona', 'Ateca', 'Tarraco'],
  Skoda: ['Fabia', 'Scala', 'Octavia', 'Superb', 'Kamiq', 'Karoq', 'Kodiaq', 'Elroq', 'Enyaq'],
  Subaru: ['Crosstrek', 'Forester', 'Outback', 'XV', 'Solterra'],
  Suzuki: ['Swift', 'Vitara', 'S-Cross', 'Jimny', 'Ignis'],
  Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X'],
  Togg: ['T10X', 'T10F'],
  Toyota: ['Yaris', 'Yaris Cross', 'Corolla', 'Corolla Hatchback', 'Corolla Cross', 'C-HR', 'RAV4', 'Camry', 'bZ4X', 'Land Cruiser', 'Hilux', 'Proace City', 'Proace', 'Auris'],
  Volkswagen: ['Polo', 'Golf', 'Golf Variant', 'Jetta', 'Passat', 'Passat Variant', 'T-Cross', 'T-Roc', 'Taigo', 'Tiguan', 'Tiguan Allspace', 'Touareg', 'ID.3', 'ID.4', 'ID.7', 'ID. Buzz', 'Caddy', 'Transporter', 'Caravelle', 'Multivan', 'Amarok', 'Crafter'],
  Volvo: ['EX30', 'EX40', 'EC40', 'XC40', 'XC60', 'XC90', 'S60', 'S90', 'V60', 'V90'],
}

/** "Renault Clio" biçiminde düz liste (marka alfabetik, modeller verilen sırada). */
export const CAR_MODEL_OPTIONS: { brand: string; model: string; label: string }[] = Object.entries(CAR_MODELS)
  .sort(([a], [b]) => a.localeCompare(b, 'tr'))
  .flatMap(([brand, models]) => models.map((model) => ({ brand, model, label: `${brand} ${model}` })))

/** Model yılı seçenekleri — gelecek yıldan 1990'a. */
export function modelYearOptions(): number[] {
  const next = new Date().getFullYear() + 1
  return Array.from({ length: next - 1990 + 1 }, (_, i) => next - i)
}
