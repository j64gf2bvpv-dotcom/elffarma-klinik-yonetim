import { supabase } from '@/lib/supabaseClient'
import { createCustomer, deleteCustomer } from '@/features/customers/api'
import { createProduct, deactivateProduct, reactivateProduct } from '@/features/stock/api'
import { recordStockMovement } from '@/features/stock/api'
import { createSale } from '@/features/sales/api'
import { createPayment } from '@/features/payments/api'
import { createSalesRep, updateSalesRep, deleteSalesRep } from '@/features/salesReps/api'
import { createReminder, deleteReminder } from '@/features/reminders/api'
import {
  createCongress,
  deleteCongress,
  createCongressStockItem,
  updateCongressStockItemStatus,
} from '@/features/congresses/api'
import { createVisit, deleteVisit } from '@/features/doctorVisits/api'
import { createExpense, deleteExpense } from '@/features/expenses/api'
import { createCommissionRule, deleteCommissionRule } from '@/features/commissions/api'
import { createSampleRequest } from '@/features/samples/api'
import { createProductLot } from '@/features/stock/api'
import { createClinic, deleteClinic } from '@/features/clinics/api'
import { createCrmActivity, createCrmOpportunity } from '@/features/crm/api'
import { createVehicle, createVehicleFuelLog, deleteVehicle } from '@/features/vehicles/api'
import { createInstagramLead, deleteInstagramLead } from '@/features/instagramLeads/api'
import { fetchBudgetTargets, saveBudgetTarget } from '@/features/budget/api'
import { iconImageDataUri, iconTones, icons } from '@/lib/iconImage'
import type { CrmOpportunityStage, ExpenseCategory, PaymentMethod, Product } from '@/types/database'

/**
 * Panel/grafikleri ve diğer sayfaları gerçek görünümüyle denemek için tek
 * tıkla eklenip silinebilen örnek veri seti. Gerçek müşteri/ürün verisiyle
 * karışmasın diye her satır açıkça işaretleniyor: doktorlarda `tags` içinde
 * DEMO_TAG, ürünlerde SKU'da DEMO_SKU_PREFIX, tags/sku'su olmayan tablolarda
 * (temsilci/hatırlatma/kongre/ziyaret/gider/araç/Instagram doktoru) isim/
 * başlık/not alanında DEMO_LABEL_PREFIX — silme işlemi SADECE bu işaretli satırları bulup
 * kaldırıyor. Doktorları silmek customers.id'ye `on delete cascade` bağlı
 * payments/sales/vb. satırları da otomatik temizliyor (bkz.
 * supabase/schema.sql); ürünler ayrıca siliniyor (stock_movements/
 * product_lots ürüne cascade bağlı). doctor_visits.customer_id `on delete
 * set null` olduğu için ziyaretler ayrıca kendi işaretiyle temizleniyor.
 * CRM aktivite/fırsatları ve numune talepleri customer_id'ye `on delete
 * cascade` bağlı olduğu için ayrıca silinmiyor, doktor silinince otomatik
 * temizleniyor. Bütçe hedefleri (budget_targets) tablo yıl+ay üzerinden upsert
 * edildiği ve örnek/gerçek veriyi ayırt edecek bir etiket alanı olmadığı için
 * SADECE o ay için henüz hiç hedef girilmemişse ekleniyor (var olanı asla
 * EZMİYOR) — bu yüzden clearDemoData bunu geri silmiyor: hangisinin örnek,
 * hangisinin kullanıcının kendi girdiği gerçek hedef olduğu güvenle ayırt
 * edilemiyor, kullanıcı isterse Bütçe sayfasından elle değiştirebilir.
 */
export const DEMO_TAG = 'örnek-veri'
const DEMO_SKU_PREFIX = 'ORNEK-'
const DEMO_LABEL_PREFIX = '[Örnek]'

const DEMO_CUSTOMERS = [
  { full_name: 'Dr. Ayşe Yılmaz', phone: '0532 111 22 33', province: 'İstanbul', doctor_type: 'sahis' as const, total_debt: 15000, is_vip: true, tone: iconTones.pink },
  {
    full_name: 'Dr. Mehmet Demir',
    phone: '0533 222 33 44',
    province: 'Ankara',
    doctor_type: 'hastane' as const,
    hospital_name: 'Ankara Şehir Hastanesi',
    total_debt: 8000,
    is_vip: false,
    tone: iconTones.blue,
  },
  { full_name: 'Dr. Elif Kaya', phone: '0534 333 44 55', province: 'İzmir', doctor_type: 'sahis' as const, total_debt: 0, is_vip: false, tone: iconTones.green },
  { full_name: 'Dr. Can Öztürk', phone: '0535 444 55 66', province: 'Bursa', doctor_type: 'sahis' as const, total_debt: 0, is_vip: false, tone: iconTones.orange },
  {
    full_name: 'Dr. Zeynep Arslan',
    phone: '0536 555 66 77',
    province: 'Antalya',
    doctor_type: 'hastane' as const,
    hospital_name: 'Antalya Eğitim Hastanesi',
    total_debt: 22000,
    is_vip: true,
    tone: iconTones.purple,
  },
]

const DEMO_PRODUCTS = [
  { name: '[Örnek] Bvrs PL', sku: `${DEMO_SKU_PREFIX}BVRSPL`, unit_cost: 800, unit_price: 1200, icon: icons.syringe, tone: iconTones.blue },
  { name: '[Örnek] Bvrs AMC', sku: `${DEMO_SKU_PREFIX}BVRSAMC`, unit_cost: 700, unit_price: 1100, icon: icons.droplet, tone: iconTones.teal },
  { name: '[Örnek] Sapphire PDRN', sku: `${DEMO_SKU_PREFIX}SAPPDRN`, unit_cost: 500, unit_price: 900, icon: icons.flaskConical, tone: iconTones.green },
  { name: '[Örnek] Fillicia', sku: `${DEMO_SKU_PREFIX}FILLICIA`, unit_cost: 450, unit_price: 800, icon: icons.testTube, tone: iconTones.red },
]

const DEMO_SALES_REPS = [
  { name: `${DEMO_LABEL_PREFIX} Deniz Aydın`, tone: iconTones.blue },
  { name: `${DEMO_LABEL_PREFIX} Selin Koç`, tone: iconTones.pink },
  { name: `${DEMO_LABEL_PREFIX} Barış Şahin`, tone: iconTones.purple },
]

const DEMO_INSTAGRAM_LEADS = [
  { full_name: `${DEMO_LABEL_PREFIX} Dr. Elif Yıldız`, instagram_username: '@dr.elifyildiz', phone: '0537 666 77 88' },
  { full_name: `${DEMO_LABEL_PREFIX} Dr. Kaan Öz`, instagram_username: '@drkaanoz.estetik', phone: '0538 777 88 99' },
]

const DEMO_VEHICLE = {
  brand_model: `${DEMO_LABEL_PREFIX} Renault Clio`,
  year: 2023,
  plate_number: '34 ÖRN 01',
  registration_info: 'Örnek veri — ruhsat no DEMO-001',
  vendor_company: 'Örnek Filo Kiralama A.Ş.',
  monthly_rental_price: 18500,
  has_utts: true,
}

const DEMO_REMINDERS = [
  { title: `${DEMO_LABEL_PREFIX} Dr. Ayşe Yılmaz'ı ara`, note: 'Sipariş takibi için deneme hatırlatması', daysAhead: 1 },
  { title: `${DEMO_LABEL_PREFIX} Kongre kayıt son tarihi`, note: 'Deneme hatırlatması', daysAhead: 3 },
  { title: `${DEMO_LABEL_PREFIX} Tahsilat vadesi yaklaşıyor`, note: 'Deneme hatırlatması', daysAhead: 5 },
]

const DEMO_CONGRESS = {
  name: `${DEMO_LABEL_PREFIX} Estetik Tıp Kongresi`,
  city: 'İstanbul',
  daysAhead: 20,
  durationDays: 3,
  single_person_price: 8500,
  two_person_price: 15000,
  image_url: iconImageDataUri(icons.presentation, iconTones.purple),
}

const DEMO_COMMISSION_RULE = `${DEMO_LABEL_PREFIX} Genel Satış Primi`

const DEMO_CLINICS = [
  { name: `${DEMO_LABEL_PREFIX} Nova Estetik Klinik`, address: 'İstanbul', category: 'Klinik', is_vip: true },
  { name: `${DEMO_LABEL_PREFIX} Şehir Hastanesi Estetik Bölümü`, address: 'Ankara', category: 'Hastane', is_vip: false },
]

// 5 örnek doktor için 5 CRM aşaması bire bir eşleniyor ki Kanban panosunun
// TÜM sütunları (Yeni/Teklif/Müzakere/Kazanıldı/Kaybedildi) dolu görünsün.
const CRM_STAGES: CrmOpportunityStage[] = ['yeni', 'teklif', 'muzakere', 'kazanildi', 'kaybedildi']

const DEMO_EXPENSES: { category: ExpenseCategory; amount: number; description: string }[] = [
  { category: 'hizmet_gideri', amount: 4500, description: `${DEMO_LABEL_PREFIX} Deneme kargo gideri` },
  { category: 'diger', amount: 2200, description: `${DEMO_LABEL_PREFIX} Deneme ofis gideri` },
]

const PAYMENT_METHODS: PaymentMethod[] = ['nakit', 'kredi_karti', 'havale', 'pos']

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function isoDaysAhead(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function dateDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function dateDaysAhead(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export interface SeedResult {
  customers: number
  products: number
  payments: number
  sales: number
  salesReps: number
  reminders: number
  congresses: number
  visits: number
  expenses: number
  sampleRequests: number
  commissionRules: number
  clinics: number
  crmActivities: number
  crmOpportunities: number
  vehicles: number
  fuelLogs: number
  instagramLeads: number
  budgetTargets: number
}

export async function seedDemoData(): Promise<SeedResult> {
  const createdCustomers = []
  for (const c of DEMO_CUSTOMERS) {
    const baseInput = {
      full_name: c.full_name,
      phone: c.phone,
      tags: [DEMO_TAG],
      is_invoiced: false,
      doctor_type: c.doctor_type,
      province: c.province,
      hospital_name: 'hospital_name' in c ? c.hospital_name : null,
      total_debt: c.total_debt || null,
    }
    // is_vip, customers tablosuna görece yeni eklenen bir sütun (bkz.
    // supabase/schema.sql) — şema henüz güncellenmemişse bu alanla INSERT
    // tamamen başarısız olup TÜM örnek veri eklemeyi (sonraki tüm adımları)
    // daha ilk doktorda durdurabiliyordu. Önce tam haliyle deneniyor, sadece
    // bu yüzden başarısız olursa is_vip'siz tekrar deneniyor — böylece şema
    // güncel değilse bile geri kalan örnek veri yine de eklenebiliyor.
    let created
    try {
      created = await createCustomer({ ...baseInput, is_vip: c.is_vip, photo_url: iconImageDataUri(icons.user, c.tone) })
    } catch (err) {
      console.warn('Örnek veri: doktor is_vip/photo_url ile eklenemedi, alanlar olmadan tekrar deneniyor (şema güncel olmayabilir)', err)
      created = await createCustomer(baseInput)
    }
    createdCustomers.push(created)
  }

  const createdProducts: Product[] = []
  for (const [i, p] of DEMO_PRODUCTS.entries()) {
    const productInput = {
      name: p.name,
      sku: p.sku,
      unit: 'Paket',
      critical_stock_threshold: 5,
      unit_cost: p.unit_cost,
      unit_price: p.unit_price,
      image_url: iconImageDataUri(p.icon, p.tone),
    }
    // "Örnek Verileri Sil" ürünleri gerçekten SİLMİYOR, deaktive ediyor
    // (stock_movements/sales gibi tablolardan FK ile referanslanabildikleri
    // için) — bu yüzden yeniden "Ekle" çalıştırılınca aynı SKU ile INSERT
    // denemek products_sku_key UNIQUE kısıtını ihlal edip TÜM eklemeyi
    // durduruyordu (kullanıcı isteğiyle bulundu, 2026-08-22). Önce aynı
    // SKU'lu (aktif/deaktif fark etmeksizin) bir ürün var mı bakılıyor;
    // varsa yeniden aktif edilip alanları tazeleniyor, yoksa yeni oluşturuluyor.
    const { data: existing } = await supabase.from('products').select('id').eq('sku', p.sku).maybeSingle()
    const created = existing ? await reactivateProduct(existing.id, productInput) : await createProduct(productInput)
    await recordStockMovement({
      product_id: created.id,
      movement_type: 'in',
      quantity: randomInt(20, 50),
      reason: 'Örnek veri — başlangıç stoğu',
    })

    // İlk ürüne SKT'si yaklaşan bir lot ekle ki "Lot / SKT Riski" widget'ı da
    // boş görünmesin — diğerlerine uzak vadeli, risksiz bir lot.
    const lot = await createProductLot({
      product_id: created.id,
      lot_no: `${DEMO_LABEL_PREFIX} LOT-${i + 1}`,
      expiry_date: i === 0 ? dateDaysAhead(randomInt(10, 60)) : dateDaysAhead(randomInt(200, 400)),
    })
    await recordStockMovement({
      product_id: created.id,
      movement_type: 'in',
      quantity: randomInt(5, 15),
      reason: 'Örnek veri — lot stoğu',
      lot_id: lot.id,
    })

    createdProducts.push(created)
  }

  const createdSalesReps = []
  for (const rep of DEMO_SALES_REPS) {
    const created = await createSalesRep(rep.name)
    const withPhoto = await updateSalesRep(created.id, { photo_url: iconImageDataUri(icons.user, rep.tone) })
    createdSalesReps.push(withPhoto)
  }

  const createdClinics = []
  for (const c of DEMO_CLINICS) {
    createdClinics.push(
      await createClinic({
        name: c.name,
        address: c.address,
        category: c.category,
        is_vip: c.is_vip,
        working_days: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'],
      }),
    )
  }

  let paymentsCount = 0
  let salesCount = 0
  let sampleRequestsCount = 0
  let crmActivitiesCount = 0
  let crmOpportunitiesCount = 0

  for (const [index, customer] of createdCustomers.entries()) {
    const rep = createdSalesReps[randomInt(0, createdSalesReps.length - 1)]

    const paymentRounds = randomInt(2, 3)
    for (let i = 0; i < paymentRounds; i++) {
      await createPayment({
        customer_id: customer.id,
        amount: randomInt(5, 25) * 1000,
        payment_method: PAYMENT_METHODS[randomInt(0, PAYMENT_METHODS.length - 1)],
        description: 'Örnek veri — deneme tahsilatı',
        paid_at: isoDaysAgo(randomInt(1, 150)),
        sales_rep_id: rep.id,
      })
      paymentsCount++
    }

    // En az bir satış bu ay içinde olsun ki "En Çok Satan Ürünler" / "Temsilci
    // Performansı" gibi "bu ay" bazlı panel widget'ları boş görünmesin.
    const saleDaysAgo = [randomInt(1, 20), ...Array.from({ length: randomInt(0, 1) }, () => randomInt(21, 150))]
    let lastSoldProduct: Product | null = null
    let lastSoldDaysAgo = 0
    for (const daysAgo of saleDaysAgo) {
      const product = createdProducts[randomInt(0, createdProducts.length - 1)]
      await createSale({
        type: 'sale',
        customer_id: customer.id,
        sales_rep_id: rep.id,
        product_id: product.id,
        product_name: product.name,
        quantity: randomInt(1, 5),
        unit_price: Number(product.unit_price ?? 0),
        sale_date: dateDaysAgo(daysAgo),
        note: 'Örnek veri — deneme satışı',
      })
      salesCount++
      lastSoldProduct = product
      lastSoldDaysAgo = daysAgo
    }

    // Numune talebi, satılan üründen biriyle ve satıştan ÖNCEKİ bir tarihle
    // oluşturuluyor ki "Numune Dönüşüm Oranı" widget'ı bunu satışa dönüşmüş
    // olarak görsün (bkz. calculateSampleConversion).
    if (lastSoldProduct) {
      await createSampleRequest({
        customer_id: customer.id,
        sales_rep_id: rep.id,
        request_date: dateDaysAgo(lastSoldDaysAgo + randomInt(5, 15)),
        note: `${DEMO_LABEL_PREFIX} Deneme numune talebi`,
        items: [
          {
            product_id: lastSoldProduct.id,
            quantity: randomInt(1, 2),
            unit_price: Number(lastSoldProduct.unit_price ?? 0),
          },
        ],
      })
      sampleRequestsCount++
    }

    await createCrmActivity({
      customer_id: customer.id,
      activity_type: 'toplanti',
      subject: `${DEMO_LABEL_PREFIX} Deneme görüşme`,
      note: 'Örnek veri — deneme CRM aktivitesi',
      occurred_at: isoDaysAgo(randomInt(1, 30)),
      sales_rep_id: rep.id,
    })
    crmActivitiesCount++

    await createCrmOpportunity({
      customer_id: customer.id,
      title: `${DEMO_LABEL_PREFIX} ${customer.full_name} — ürün fırsatı`,
      stage: CRM_STAGES[index % CRM_STAGES.length],
      amount: randomInt(10, 40) * 1000,
      expected_close_date: dateDaysAhead(randomInt(10, 60)),
      sales_rep_id: rep.id,
      notes: 'Örnek veri — deneme fırsat',
    })
    crmOpportunitiesCount++

    await createVisit({
      visit_date: dateDaysAgo(randomInt(1, 60)),
      doctor_name: customer.full_name,
      customer_id: customer.id,
      sales_rep_id: rep.id,
      notes: `${DEMO_LABEL_PREFIX} Deneme ziyareti`,
    })
  }

  let remindersCount = 0
  for (const r of DEMO_REMINDERS) {
    await createReminder({ title: r.title, note: r.note, due_date: isoDaysAhead(r.daysAhead) })
    remindersCount++
  }

  const createdCongress = await createCongress({
    name: DEMO_CONGRESS.name,
    city: DEMO_CONGRESS.city,
    start_date: dateDaysAhead(DEMO_CONGRESS.daysAhead),
    end_date: dateDaysAhead(DEMO_CONGRESS.daysAhead + DEMO_CONGRESS.durationDays),
    will_attend: true,
    notes: `${DEMO_LABEL_PREFIX} Deneme kongre kaydı`,
    single_person_price: DEMO_CONGRESS.single_person_price,
    two_person_price: DEMO_CONGRESS.two_person_price,
    image_url: DEMO_CONGRESS.image_url,
  })

  // Ürün ve Sarf Malzeme Takibi için örnek: bir ürün "sarf edildi" olarak
  // işaretlenmiş, bir ürün hâlâ "götürüldü (bekliyor)" durumunda. congress_stock_items
  // de görece yeni bir tablo — şema güncel değilse burası ayrı bir try/catch'te
  // (bkz. yukarıdaki araç/Instagram bloğundaki aynı gerekçe).
  try {
    if (createdProducts[0]) {
      const stockItem = await createCongressStockItem({
        congress_id: createdCongress.id,
        product_id: createdProducts[0].id,
        product_name: createdProducts[0].name,
        quantity: 5,
        unit_price: createdProducts[0].unit_price,
        note: `${DEMO_LABEL_PREFIX} sarf malzeme`,
      })
      await recordStockMovement({
        product_id: createdProducts[0].id,
        movement_type: 'out',
        quantity: 5,
        reason: 'Kongre/Workshop için götürüldü',
        note: DEMO_CONGRESS.name,
      })
      await updateCongressStockItemStatus(stockItem.id, 'sarf_edildi')
    }
    if (createdProducts[1]) {
      await createCongressStockItem({
        congress_id: createdCongress.id,
        product_id: createdProducts[1].id,
        product_name: createdProducts[1].name,
        quantity: 3,
        unit_price: createdProducts[1].unit_price,
        note: `${DEMO_LABEL_PREFIX} stand vitrini`,
      })
      await recordStockMovement({
        product_id: createdProducts[1].id,
        movement_type: 'out',
        quantity: 3,
        reason: 'Kongre/Workshop için götürüldü',
        note: DEMO_CONGRESS.name,
      })
    }
  } catch (err) {
    console.warn('Örnek veri: kongre ürün/sarf malzeme kaydı eklenemedi (şema güncel olmayabilir)', err)
  }

  await createCommissionRule({
    name: DEMO_COMMISSION_RULE,
    scope_type: 'all',
    scope_value: null,
    basis: 'satis',
    rate_percent: 10,
    is_active: true,
  })

  let expensesCount = 0
  for (const e of DEMO_EXPENSES) {
    await createExpense({
      category: e.category,
      amount: e.amount,
      description: e.description,
      expense_date: dateDaysAgo(randomInt(1, 60)),
    })
    expensesCount++
  }

  // Araçlar ve Instagram Doktor Listesi görece yeni tablolar (bkz.
  // supabase/schema.sql) — bir kurulumda henüz şema güncellenmemişse bu
  // bölümler tek başına başarısız olabilir. Buraya kadar oluşturulan TÜM
  // diğer örnek veri (doktor/ürün/satış/tahsilat/kongre/CRM/vb.) kalıcı
  // olarak eklenmiş durumda — o başarıyı "eklenemedi" gibi yanlış bir
  // hataya boğmamak için bu iki bölüm ayrı try/catch'e alındı; başarısız
  // olurlarsa sadece konsola uyarı düşer, sonuçta 0 olarak görünürler.
  let vehiclesCount = 0
  let fuelLogsCount = 0
  try {
    const createdVehicle = await createVehicle({
      brand_model: DEMO_VEHICLE.brand_model,
      year: DEMO_VEHICLE.year,
      plate_number: DEMO_VEHICLE.plate_number,
      registration_info: DEMO_VEHICLE.registration_info,
      vendor_company: DEMO_VEHICLE.vendor_company,
      sales_rep_id: createdSalesReps[0]?.id ?? null,
      monthly_rental_price: DEMO_VEHICLE.monthly_rental_price,
      maintenance_date: dateDaysAhead(randomInt(15, 45)),
      has_utts: DEMO_VEHICLE.has_utts,
      notes: `${DEMO_LABEL_PREFIX} Deneme araç kaydı`,
    })
    vehiclesCount = 1
    await createVehicleFuelLog({
      vehicle_id: createdVehicle.id,
      fill_date: dateDaysAgo(randomInt(1, 10)),
      amount: randomInt(800, 2000),
      note: `${DEMO_LABEL_PREFIX} Deneme yakıt kaydı`,
    })
    fuelLogsCount = 1
  } catch (err) {
    console.warn('Örnek veri: araç/yakıt kaydı eklenemedi (şema güncel olmayabilir)', err)
  }

  let instagramLeadsCount = 0
  try {
    for (const lead of DEMO_INSTAGRAM_LEADS) {
      await createInstagramLead({
        full_name: lead.full_name,
        instagram_username: lead.instagram_username,
        phone: lead.phone,
        notes: `${DEMO_LABEL_PREFIX} Deneme Instagram doktor kaydı`,
      })
      instagramLeadsCount++
    }
  } catch (err) {
    console.warn('Örnek veri: Instagram doktoru eklenemedi (şema güncel olmayabilir)', err)
  }

  // Bütçe Yılı sayfası "hedef yok" boş görünmesin diye bu ay için, SADECE
  // henüz hiç hedef girilmemişse (var olan gerçek bir hedefi asla ezmeden)
  // makul bir örnek hedef ekleniyor.
  let budgetTargetsCount = 0
  try {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const existingTargets = await fetchBudgetTargets(currentYear)
    if (!existingTargets.some((t) => t.month === currentMonth)) {
      await saveBudgetTarget(currentYear, currentMonth, 150000)
      budgetTargetsCount = 1
    }
  } catch (err) {
    console.warn('Örnek veri: bütçe hedefi eklenemedi', err)
  }

  return {
    customers: createdCustomers.length,
    products: createdProducts.length,
    payments: paymentsCount,
    sales: salesCount,
    salesReps: createdSalesReps.length,
    reminders: remindersCount,
    congresses: 1,
    visits: createdCustomers.length,
    expenses: expensesCount,
    sampleRequests: sampleRequestsCount,
    commissionRules: 1,
    clinics: createdClinics.length,
    crmActivities: crmActivitiesCount,
    crmOpportunities: crmOpportunitiesCount,
    vehicles: vehiclesCount,
    fuelLogs: fuelLogsCount,
    instagramLeads: instagramLeadsCount,
    budgetTargets: budgetTargetsCount,
  }
}

export interface ClearResult {
  customersDeleted: number
  productsDeleted: number
  salesRepsDeleted: number
  remindersDeleted: number
  congressesDeleted: number
  visitsDeleted: number
  expensesDeleted: number
  commissionRulesDeleted: number
  clinicsDeleted: number
  vehiclesDeleted: number
  instagramLeadsDeleted: number
}

async function deleteAllByIlike(
  table:
    | 'sales_reps'
    | 'reminders'
    | 'congresses'
    | 'doctor_visits'
    | 'expenses'
    | 'commission_rules'
    | 'clinics'
    | 'vehicles'
    | 'instagram_leads',
  column: string,
) {
  const { data, error } = await supabase.from(table).select('id').ilike(column, `${DEMO_LABEL_PREFIX}%`)
  if (error) throw error
  return data ?? []
}

export async function clearDemoData(): Promise<ClearResult> {
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id')
    .contains('tags', [DEMO_TAG])
  if (customersError) throw customersError

  const visits = await deleteAllByIlike('doctor_visits', 'notes')
  for (const v of visits) await deleteVisit(v.id)

  for (const c of customers ?? []) {
    await deleteCustomer(c.id)
  }

  // Kalıcı silme (offlineDelete) burada kasıtlı KULLANILMIYOR — bu ürünler
  // seedDemoData'nın kendi oluşturduğu örnek numune taleplerinden (sample_items)
  // referans alabiliyor, bu da DELETE'i "foreign key constraint" hatasıyla
  // reddedip temizlemeyi yarım bırakıyordu (canlı veritabanında doğrulandı).
  // Gerçek ürünlerdeki "Ürünü kaldır" ile aynı yumuşak silme (is_active=false)
  // bu riski tamamen ortadan kaldırıyor.
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id')
    .like('sku', `${DEMO_SKU_PREFIX}%`)
  if (productsError) throw productsError
  for (const p of products ?? []) {
    await deactivateProduct(p.id)
  }

  const salesReps = await deleteAllByIlike('sales_reps', 'name')
  for (const r of salesReps) await deleteSalesRep(r.id)

  const reminders = await deleteAllByIlike('reminders', 'title')
  for (const r of reminders) await deleteReminder(r.id)

  const congresses = await deleteAllByIlike('congresses', 'name')
  for (const c of congresses) await deleteCongress(c.id)

  const expenses = await deleteAllByIlike('expenses', 'description')
  for (const e of expenses) await deleteExpense(e.id)

  const commissionRules = await deleteAllByIlike('commission_rules', 'name')
  for (const r of commissionRules) await deleteCommissionRule(r.id)

  const clinics = await deleteAllByIlike('clinics', 'name')
  for (const c of clinics) await deleteClinic(c.id)

  // vehicle_fuel_logs, vehicles.id'ye `on delete cascade` bağlı (bkz.
  // supabase/schema.sql) — aracı silmek yeterli, yakıt kayıtları otomatik gider.
  // Araçlar ve Instagram Doktor Listesi görece yeni tablolar — şema güncel
  // değilse (bkz. seedDemoData'daki aynı gerekçe) burada da ayrı try/catch'te,
  // aksi halde buraya kadar başarıyla silinmiş her şey "silinemedi" hatasına
  // boğulurdu.
  let vehicles: { id: string }[] = []
  try {
    vehicles = await deleteAllByIlike('vehicles', 'notes')
    for (const v of vehicles) await deleteVehicle(v.id)
  } catch (err) {
    console.warn('Örnek veri silme: araç kaydı silinemedi (şema güncel olmayabilir)', err)
  }

  let instagramLeads: { id: string }[] = []
  try {
    instagramLeads = await deleteAllByIlike('instagram_leads', 'notes')
    for (const l of instagramLeads) await deleteInstagramLead(l.id)
  } catch (err) {
    console.warn('Örnek veri silme: Instagram doktoru silinemedi (şema güncel olmayabilir)', err)
  }

  return {
    customersDeleted: customers?.length ?? 0,
    productsDeleted: products?.length ?? 0,
    salesRepsDeleted: salesReps.length,
    remindersDeleted: reminders.length,
    congressesDeleted: congresses.length,
    visitsDeleted: visits.length,
    expensesDeleted: expenses.length,
    commissionRulesDeleted: commissionRules.length,
    clinicsDeleted: clinics.length,
    vehiclesDeleted: vehicles.length,
    instagramLeadsDeleted: instagramLeads.length,
  }
}
