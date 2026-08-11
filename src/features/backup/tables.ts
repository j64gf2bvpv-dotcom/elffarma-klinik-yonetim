/**
 * Buluta Yedekleme'nin döktüğü tablo listesi — shared-trust (herhangi bir
 * aktif personelin zaten tek tek okuyabildiği) iş verisi tabloları. Bilinçli
 * olarak DIŞARIDA bırakılanlar:
 * - `staff_ai_keys`: kişisel API anahtarları düz metin tutuluyor, asla dışa aktarılmaz.
 * - `audit_logs`: değiştirilemez/silinemez denetim kaydı — ayrı bir JSON kopyası
 *   çıkarmak tasarım amacını zayıflatır, sadece admin okuyabiliyor.
 * - `staff` / `staff_messages`: personel bilgisi ve iç yazışma — "iş verisi"
 *   (müşteri/ürün/finans) kapsamının dışında.
 * - `ai_conversations` / `ai_messages` / `ai_usage_logs`: AI sohbet geçmişi/telemetri,
 *   iş verisi değil.
 * - `app_settings`: uygulama yapılandırması, iş kaydı değil.
 *
 * Şemaya yeni bir shared-trust iş tablosu eklendiğinde bu listeye de eklenmeli.
 */
export const BACKUP_TABLES = [
  'customers',
  'products',
  'product_lots',
  'stock_movements',
  'stock_counts',
  'stock_count_items',
  'payments',
  'payment_installment_plans',
  'payment_installments',
  'invoices',
  'sales',
  'sales_reps',
  'commission_rules',
  'commission_adjustments',
  'appointments',
  'doctor_visits',
  'visit_plans',
  'reminders',
  'tasks',
  'expenses',
  'budget_targets',
  'congresses',
  'congress_participants',
  'congress_participant_products',
  'congress_remaining_products',
  'congress_checklist_items',
  'congress_stock_items',
  'congress_consumables',
  'sample_requests',
  'sample_items',
  'customer_pending_products',
  'customer_revenue_targets',
  'crm_activities',
  'crm_opportunities',
  'quotes',
  'quote_items',
  'competitor_reports',
  'regions',
  'clinics',
  'whatsapp_templates',
  'attachments',
] as const
