import { CLINIC_NAME } from '@/lib/supabaseClient'
import { companyInfo } from '@/lib/companyInfo'

export interface TemplateContext {
  ad?: string
  tarih?: string
  saat?: string
}

const PLACEHOLDER_PATTERN = /{{\s*(ad|tarih|saat|klinik_adi|iban)\s*}}/g

export function renderTemplate(body: string, context: TemplateContext): string {
  const values: Record<string, string> = {
    ad: context.ad ?? '',
    tarih: context.tarih ?? '',
    saat: context.saat ?? '',
    klinik_adi: CLINIC_NAME,
    iban: companyInfo.iban,
  }
  return body.replace(PLACEHOLDER_PATTERN, (_match, key: string) => values[key] ?? '')
}

export function buildWhatsAppUrl(waDigits: string, message: string): string {
  return `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`
}

export async function openWhatsApp(url: string): Promise<boolean> {
  if (window.electronAPI?.openWhatsApp) {
    return window.electronAPI.openWhatsApp(url)
  }
  // Tarayıcıda (npm run dev'de electron dışı önizleme) çalışırken de sorunsuz açılsın
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
