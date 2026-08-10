// Master talimat §20: "PDF teklif oluşturulabilmeli." expo-print HTML→PDF
// kullanıyor (masaüstündeki jsPDF+NotoSans yerine — RN'de native bir PDF
// motoru yok, expo-print cihazın kendi render motorunu kullanır ve Türkçe
// karakterleri sorunsuz basar, ek font gömme gerekmez).
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { CLINIC_NAME } from '@/lib/supabaseClient'
import type { Quote, QuoteItem } from '@shared/types/database'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildQuoteHtml(quote: Quote, items: QuoteItem[], customerName: string): string {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * Number(i.unit_price), 0)
  const discountAmount = subtotal * (Number(quote.discount_rate) / 100)
  const afterDiscount = subtotal - discountAmount
  const vatAmount = afterDiscount * (Number(quote.vat_rate) / 100)
  const grandTotal = afterDiscount + vatAmount

  const rows = items
    .map(
      (i) => `
        <tr>
          <td>${escapeHtml(i.product_name)}</td>
          <td style="text-align:center">${i.quantity}</td>
          <td style="text-align:right">${currency(Number(i.unit_price))}</td>
          <td style="text-align:right">${currency(i.quantity * Number(i.unit_price))}</td>
        </tr>`,
    )
    .join('')

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; color: #111; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .muted { color: #666; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; }
          th, td { padding: 8px 6px; border-bottom: 1px solid #ddd; font-size: 13px; }
          th { text-align: left; background: #f5f5f5; }
          .totals { margin-top: 16px; width: 260px; margin-left: auto; }
          .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
          .totals .grand { font-weight: 700; font-size: 16px; border-top: 2px solid #111; padding-top: 8px; margin-top: 4px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(CLINIC_NAME)}</h1>
        <div class="muted">Teklif No: ${escapeHtml(quote.quote_number)}</div>
        <div class="muted">Tarih: ${new Date(quote.created_at).toLocaleDateString('tr-TR')}</div>
        ${quote.valid_until ? `<div class="muted">Geçerlilik: ${new Date(quote.valid_until).toLocaleDateString('tr-TR')}</div>` : ''}
        <div class="muted" style="margin-top:8px">Doktor: ${escapeHtml(customerName)}</div>
        <table>
          <thead><tr><th>Ürün</th><th style="text-align:center">Adet</th><th style="text-align:right">Birim Fiyat</th><th style="text-align:right">Toplam</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          <div><span>Ara Toplam</span><span>${currency(subtotal)}</span></div>
          ${quote.discount_rate > 0 ? `<div><span>İskonto (%${quote.discount_rate})</span><span>-${currency(discountAmount)}</span></div>` : ''}
          <div><span>KDV (%${quote.vat_rate})</span><span>${currency(vatAmount)}</span></div>
          <div class="grand"><span>Genel Toplam</span><span>${currency(grandTotal)}</span></div>
        </div>
        ${quote.note ? `<div class="muted" style="margin-top:24px">Not: ${escapeHtml(quote.note)}</div>` : ''}
      </body>
    </html>
  `
}

export async function generateAndShareQuotePdf(quote: Quote, items: QuoteItem[], customerName: string): Promise<void> {
  const html = buildQuoteHtml(quote, items, customerName)
  const { uri } = await Print.printToFileAsync({ html })
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Teklif ${quote.quote_number}` })
  }
}
