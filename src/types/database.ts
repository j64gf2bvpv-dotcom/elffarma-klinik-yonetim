export type StaffRole = 'admin' | 'staff'
export type MovementType = 'in' | 'out' | 'adjustment'
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
