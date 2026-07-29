export type StaffRole = 'admin' | 'staff'
export type MovementType = 'in' | 'out' | 'adjustment' | 'sample'
export type PaymentMethod = 'nakit' | 'kredi_karti' | 'havale'
export type DoctorType = 'sahis' | 'hastane'
export type BrandLine = 'dermakor' | 'swiss'

export interface Staff {
  id: string
  full_name: string
  role: StaffRole
  phone: string | null
  is_active: boolean
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
  photo_url: string | null
  sample_monthly_quota: number | null
  sample_yearly_quota: number | null
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
  created_at: string
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
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CongressParticipant {
  id: string
  congress_id: string
  doctor_name: string
  flight_cost: number
  registration_cost: number
  accommodation_cost: number
  notes: string | null
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

export type AttachmentOwnerType = 'customer' | 'clinic' | 'congress' | 'workshop'

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

export interface CongressRemainingProduct {
  id: string
  congress_id: string
  product_name: string
  quantity: number
  unit_price: number
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
