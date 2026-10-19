/**
 * Türkiye'nin 7 coğrafi bölgesi ve illeri (resmî sınıflandırma, 81 il).
 * Cari Kart'ta bölge bazlı arama için (kullanıcı isteği, 2026-10-19:
 * "Akdeniz bölgesi altında şehirler gibi, üstüne tıklanınca bölge araması
 * yapılabilsin"). İl adları `turkeyProvinces` ile birebir aynı yazımda.
 */
export interface TurkeyRegion {
  name: string
  provinces: string[]
}

export const turkeyRegions: TurkeyRegion[] = [
  {
    name: 'Marmara',
    provinces: ['Balıkesir', 'Bilecik', 'Bursa', 'Çanakkale', 'Edirne', 'İstanbul', 'Kırklareli', 'Kocaeli', 'Sakarya', 'Tekirdağ', 'Yalova'],
  },
  {
    name: 'Ege',
    provinces: ['Afyonkarahisar', 'Aydın', 'Denizli', 'İzmir', 'Kütahya', 'Manisa', 'Muğla', 'Uşak'],
  },
  {
    name: 'Akdeniz',
    provinces: ['Adana', 'Antalya', 'Burdur', 'Hatay', 'Isparta', 'Kahramanmaraş', 'Mersin', 'Osmaniye'],
  },
  {
    name: 'İç Anadolu',
    provinces: ['Aksaray', 'Ankara', 'Çankırı', 'Eskişehir', 'Karaman', 'Kayseri', 'Kırıkkale', 'Kırşehir', 'Konya', 'Nevşehir', 'Niğde', 'Sivas', 'Yozgat'],
  },
  {
    name: 'Karadeniz',
    provinces: [
      'Amasya', 'Artvin', 'Bartın', 'Bayburt', 'Bolu', 'Çorum', 'Düzce', 'Giresun', 'Gümüşhane',
      'Karabük', 'Kastamonu', 'Ordu', 'Rize', 'Samsun', 'Sinop', 'Tokat', 'Trabzon', 'Zonguldak',
    ],
  },
  {
    name: 'Doğu Anadolu',
    provinces: ['Ağrı', 'Ardahan', 'Bingöl', 'Bitlis', 'Elazığ', 'Erzincan', 'Erzurum', 'Hakkari', 'Iğdır', 'Kars', 'Malatya', 'Muş', 'Tunceli', 'Van'],
  },
  {
    name: 'Güneydoğu Anadolu',
    provinces: ['Adıyaman', 'Batman', 'Diyarbakır', 'Gaziantep', 'Kilis', 'Mardin', 'Siirt', 'Şanlıurfa', 'Şırnak'],
  },
]

export const ALL_PROVINCES = '__all__'
/** Coğrafi bölge seçimi "bolge:Akdeniz" biçiminde tutulur; diğer değerler il adıdır. */
export const REGION_PREFIX = 'bolge:'

/** Filtre değerini fetchCustomers'ın beklediği il / il listesine çevirir. */
export function provinceQuery(filter: string): string | string[] | undefined {
  if (filter === ALL_PROVINCES) return undefined
  if (filter.startsWith(REGION_PREFIX)) {
    return turkeyRegions.find((r) => r.name === filter.slice(REGION_PREFIX.length))?.provinces
  }
  return filter
}

export function provinceFilterLabel(filter: string): string {
  if (filter === ALL_PROVINCES) return 'Tüm Bölgeler / İller'
  if (filter.startsWith(REGION_PREFIX)) return `${filter.slice(REGION_PREFIX.length)} Bölgesi`
  return filter
}
