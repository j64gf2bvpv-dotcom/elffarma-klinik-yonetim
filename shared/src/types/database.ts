export type StaffRole = 'admin' | 'staff'
export type MovementType = 'in' | 'out' | 'adjustment' | 'sample' | 'return' | 'disposal'
export type PaymentMethod = 'nakit' | 'kredi_karti' | 'havale' | 'pos'
export type DoctorType = 'sahis' | 'hastane'
export type BrandLine = 'dermakor' | 'swiss'

export interface Staff {
  id: string
  full_name: string
  role: StaffRole
  phone: string | null
  is_active: boolean
  avatar_url: string | null
  created_at: string
}

export interface Customer {
  id: string
  full_name: string
  phone: string
  email: string | null
  notes: string | null
  tags: string[]
  is_invoiced: boolean
  doctor_type: DoctorType
  province: string | null
  hospital_name: string | null
  next_payment_due: string | null
  total_debt: number | null
  tc_no: string | null
  address: string | null
  tax_number: string | null
  vat_rate: number | null
  preferred_payment_method: PaymentMethod | null
  doctor_code: string | null
  specialty: string | null
  clinic_id: string | null
  mobile_phone: string | null
  whatsapp_phone: string | null
  website: string | null
  instagram: string | null
  district: string | null
  tax_office: string | null
  assistant_info: string | null
  secretary_info: string | null
  referrer: string | null
  sales_rep_id: string | null
  region_id: string | null
  is_active: boolean
  is_vip: boolean
  photo_url: string | null
  birth_date: string | null
  sample_monthly_quota: number | null
  sample_yearly_quota: number | null
  latitude: number | null
  longitude: number | null
  geocoded_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  sku: string | null
  category: string | null
  unit: string
  critical_stock_threshold: number
  current_quantity: number
  unit_cost: number | null
  unit_price: number | null
  campaign: string | null
  image_url: string | null
  expiry_date: string | null
  barcode: string | null
  brand_line: BrandLine | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StockMovement {
  id: string
  product_id: string
  movement_type: MovementType
  quantity: number
  reason: string | null
  customer_id: string | null
  staff_id: string | null
  note: string | null
  lot_id: string | null
  unit_price: number | null
  created_at: string
}

export interface ProductLot {
  id: string
  product_id: string
  lot_no: string | null
  barcode: string | null
  qr_code: string | null
  production_date: string | null
  expiry_date: string | null
  warehouse: string | null
  shelf: string | null
  supplier: string | null
  quantity: number
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  customer_id: string
  amount: number
  currency: string
  payment_method: PaymentMethod
  description: string | null
  staff_id: string | null
  sales_rep_id: string | null
  paid_at: string
  created_at: string
  invoice_number: string | null
  invoice_file_path: string | null
}

export interface WhatsAppTemplate {
  id: string
  name: string
  body: string
  created_at: string
  updated_at: string
}

export interface Congress {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  notes: string | null
  will_attend: boolean
  single_person_price: number | null
  two_person_price: number | null
  image_url: string | null
  city: string | null
  venue: string | null
  hotel: string | null
  capacity: number | null
  sponsorship_info: string | null
  speakers: string | null
  trainers: string | null
  meal_plan: string | null
  transfer_info: string | null
  stand_info: string | null
  budget: number | null
  campaign_info: string | null
  video_urls: string[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AttendanceStatus = 'registered' | 'attended' | 'no_show'

export interface CongressParticipant {
  id: string
  congress_id: string
  doctor_name: string
  flight_cost: number
  registration_cost: number
  accommodation_cost: number
  notes: string | null
  attendance_status: AttendanceStatus
  certificate_issued: boolean
  qr_code: string | null
  created_at: string
  updated_at: string
}

export interface CongressParticipantProduct {
  id: string
  participant_id: string
  product_name: string
  quantity: number
  unit_price: number
  sales_rep_id: string | null
  created_at: string
}

export type StockCountStatus = 'open' | 'completed'

export interface StockCount {
  id: string
  count_date: string
  status: StockCountStatus
  notes: string | null
  created_by: string | null
  created_at: string
  completed_at: string | null
}

export interface StockCountItem {
  id: string
  stock_count_id: string
  product_id: string
  expected_quantity: number
  counted_quantity: number | null
  note: string | null
  created_at: string
}

export interface DoctorVisit {
  id: string
  visit_date: string
  doctor_name: string
  phone: string | null
  email: string | null
  social_media: string | null
  notes: string | null
  sales_rep_id: string | null
  customer_id: string | null
  check_in_at: string | null
  check_out_at: string | null
  check_in_lat: number | null
  check_in_lng: number | null
  discussed_products: string | null
  competitor_products: string | null
  next_visit_date: string | null
  signature_data: string | null
  created_at: string
  updated_at: string
}

export interface SalesRep {
  id: string
  name: string
  is_active: boolean
  photo_url: string | null
  email: string | null
  vehicle_info: string | null
  license_info: string | null
  hire_date: string | null
  commission_rate: number | null
  salary: number | null
  bank_info: string | null
  sales_target: number | null
  region_id: string | null
  created_at: string
}

export interface Region {
  id: string
  name: string
  parent_region_id: string | null
  created_at: string
}

export interface Clinic {
  id: string
  name: string
  authorized_persons: string | null
  address: string | null
  phone: string | null
  tax_office: string | null
  tax_number: string | null
  employee_count: number | null
  branch_count: number | null
  sales_rep_id: string | null
  region_id: string | null
  category: string | null
  is_vip: boolean
  risk_limit: number | null
  discount_rate: number | null
  payment_method: string | null
  working_days: string[]
  maps_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AttachmentOwnerType = 'customer' | 'clinic' | 'congress' | 'workshop' | 'doctor_visit'

export interface Attachment {
  id: string
  owner_type: AttachmentOwnerType
  owner_id: string
  file_path: string
  file_name: string
  uploaded_by: string | null
  created_at: string
}

export type CommissionScopeType = 'all' | 'product' | 'category' | 'brand' | 'sales_rep' | 'clinic' | 'customer'

export type CommissionBasis = 'satis' | 'tahsilat'

export interface CommissionRule {
  id: string
  name: string
  scope_type: CommissionScopeType
  scope_value: string | null
  basis: CommissionBasis
  rate_percent: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CommissionAdjustmentType = 'bonus' | 'ceza'

export interface CommissionAdjustment {
  id: string
  sales_rep_id: string
  adjustment_type: CommissionAdjustmentType
  amount: number
  period_start: string
  period_end: string
  note: string | null
  created_by: string | null
  created_at: string
}

export type SampleRequestStatus = 'pending' | 'approved' | 'rejected' | 'shipped' | 'delivered'

export interface SampleRequest {
  id: string
  customer_id: string
  sales_rep_id: string | null
  request_date: string
  status: SampleRequestStatus
  tracking_number: string | null
  shipped_at: string | null
  delivered_at: string | null
  delivered_to: string | null
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SampleItem {
  id: string
  sample_request_id: string
  product_id: string
  lot_no: string | null
  expiry_date: string | null
  quantity: number
  unit_price: number
  created_at: string
}

export interface PaymentInstallmentPlan {
  id: string
  customer_id: string
  total_amount: number
  installment_count: number
  late_fee_rate: number
  description: string | null
  created_by: string | null
  created_at: string
}

export interface PaymentInstallment {
  id: string
  plan_id: string
  installment_no: number
  due_date: string
  amount: number
  paid_payment_id: string | null
  created_at: string
}

export type CrmActivityType = 'arama' | 'whatsapp' | 'email' | 'toplanti' | 'video_gorusme' | 'not'

export interface CrmActivity {
  id: string
  customer_id: string
  activity_type: CrmActivityType
  subject: string | null
  note: string | null
  occurred_at: string
  follow_up_date: string | null
  sales_rep_id: string | null
  created_by: string | null
  created_at: string
}

export type CrmOpportunityStage = 'yeni' | 'teklif' | 'muzakere' | 'kazanildi' | 'kaybedildi'

export interface CrmOpportunity {
  id: string
  customer_id: string
  title: string
  stage: CrmOpportunityStage
  amount: number | null
  expected_close_date: string | null
  sales_rep_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CongressRemainingProduct {
  id: string
  congress_id: string
  product_name: string
  quantity: number
  unit_price: number
  created_at: string
}

export type CongressStockItemStatus = 'goturuldu' | 'kullanildi' | 'sarf_edildi' | 'geri_dondu'

export interface CongressStockItem {
  id: string
  congress_id: string
  product_id: string | null
  product_name: string
  quantity: number
  status: CongressStockItemStatus
  unit_price: number | null
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CongressConsumable {
  id: string
  congress_id: string
  name: string
  quantity: number
  is_used: boolean
  note: string | null
  created_by: string | null
  created_at: string
}

export interface CongressChecklistItem {
  id: string
  congress_id: string
  label: string
  is_done: boolean
  created_by: string | null
  created_at: string
}

export interface CustomerPendingProduct {
  id: string
  customer_id: string
  product_name: string
  quantity: number
  unit_price: number
  note: string | null
  created_at: string
}

export interface AppSetting<T = unknown> {
  key: string
  value: T
  updated_at: string
}

export type SaleType = 'sale' | 'return'

export interface Sale {
  id: string
  type: SaleType
  customer_id: string
  sales_rep_id: string | null
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  sale_date: string
  note: string | null
  created_by: string | null
  created_at: string
}

export interface Invoice {
  id: string
  invoice_number: string
  customer_id: string
  amount: number
  issue_date: string
  note: string | null
  created_by: string | null
  created_at: string
}

export interface Reminder {
  id: string
  title: string
  note: string | null
  due_date: string
  is_done: boolean
  created_by: string | null
  created_at: string
}

export type TaskStatus = 'bekliyor' | 'devam_ediyor' | 'tamamlandi' | 'iptal'
export type TaskPriority = 'dusuk' | 'normal' | 'yuksek'

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  assigned_to: string | null
  customer_id: string | null
  completed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InstagramLead {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
  instagram_username: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ExpenseCategory = 'hizmet_gideri' | 'diger'

export interface Expense {
  id: string
  category: ExpenseCategory
  amount: number
  description: string | null
  expense_date: string
  staff_id: string | null
  created_at: string
}

export interface BudgetTarget {
  id: string
  year: number
  month: number
  target_revenue: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AIMessageRole = 'system' | 'user' | 'assistant'

export interface AIConversation {
  id: string
  title: string
  provider: string | null
  model: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AIMessageRow {
  id: string
  conversation_id: string
  role: AIMessageRole
  content: string
  created_at: string
}

export interface AIUsageLog {
  id: string
  provider: string
  model: string
  success: boolean
  duration_ms: number | null
  prompt_tokens: number | null
  completion_tokens: number | null
  error_message: string | null
  created_by: string | null
  created_at: string
}

/** Sadece sahibi tarafından okunabilir/yazılabilir — app_settings gibi paylaşılan değil. */
export interface StaffAIKeys {
  staff_id: string
  openai_api_key: string | null
  gemini_api_key: string | null
  anthropic_api_key: string | null
  updated_at: string
}

export interface Vehicle {
  id: string
  brand_model: string
  year: number | null
  plate_number: string | null
  registration_info: string | null
  vendor_company: string | null
  sales_rep_id: string | null
  monthly_rental_price: number | null
  maintenance_date: string | null
  has_utts: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface VehicleFuelLog {
  id: string
  vehicle_id: string
  fill_date: string
  amount: number
  note: string | null
  created_by: string | null
  created_at: string
}

export type CompetitorStockStatus = 'in_stock' | 'limited' | 'out_of_stock'
export type CompetitorVisibility = 'good' | 'moderate' | 'poor'

export interface CompetitorReport {
  id: string
  customer_id: string | null
  doctor_name: string | null
  competitor_name: string
  product_name: string
  stock_status: CompetitorStockStatus | null
  price: number | null
  visibility: CompetitorVisibility | null
  notes: string | null
  reported_by: string | null
  created_at: string
}

export type QuoteStatus = 'taslak' | 'gonderildi' | 'goruldu' | 'kabul_edildi' | 'reddedildi' | 'suresi_doldu'

export interface Quote {
  id: string
  quote_number: string
  customer_id: string
  status: QuoteStatus
  valid_until: string | null
  note: string | null
  discount_rate: number
  vat_rate: number
  sales_rep_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface QuoteItem {
  id: string
  quote_id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  created_at: string
}

export type AuditAction = 'insert' | 'update' | 'delete' | 'rpc'

export interface AuditLog {
  id: string
  staff_id: string | null
  staff_name: string
  action: AuditAction
  table_name: string
  record_id: string | null
  description: string
  payload: Record<string, unknown> | null
  created_at: string
}

export type VisitPlanStatus = 'bekliyor' | 'tamamlandi' | 'iptal'

export interface VisitPlan {
  id: string
  customer_id: string
  assigned_staff_id: string | null
  planned_date: string
  note: string | null
  status: VisitPlanStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface StaffMessage {
  id: string
  sender_id: string | null
  body: string | null
  attachment_path: string | null
  attachment_name: string | null
  created_at: string
}
