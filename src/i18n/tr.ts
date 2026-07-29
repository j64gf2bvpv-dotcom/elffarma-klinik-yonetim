export const tr = {
  nav: {
    dashboard: 'Ana Panel',
    customers: 'Cari Kart',
    clinics: 'Klinikler',
    stock: 'Stok Yönetimi',
    payments: 'Tahsilatlar',
    congresses: 'Kongreler',
    doctorVisits: 'Satış Temsilcisi Raporu',
    sales: 'Satışlar',
    cariHesap: 'Cari Hesap',
    expenses: 'Giderler',
    budget: 'Bütçe Yılı',
    reminders: 'Hatırlatmalar',
    agenda: 'Ajanda',
    settings: 'Ayarlar',
  },
  movementType: {
    in: 'Giriş',
    out: 'Çıkış',
    adjustment: 'Düzeltme',
  } as Record<string, string>,
  paymentMethod: {
    nakit: 'Nakit',
    kredi_karti: 'Kredi Kartı',
    havale: 'Havale/EFT (IBAN)',
  } as Record<string, string>,
  staffRole: {
    admin: 'Yönetici',
    staff: 'Personel',
  } as Record<string, string>,
  expenseCategory: {
    hizmet_gideri: 'Hizmet Gideri',
    diger: 'Diğer Giderler',
  } as Record<string, string>,
}
