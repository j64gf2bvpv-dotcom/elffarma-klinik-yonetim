import type { AIMessage } from './types'

/**
 * useBusinessSnapshot() çıktısını AI'a bağlam olarak verecek sistem mesajını üretir.
 * AIInsightsPage'in soru-cevap/rapor/öneri akışları ile AIChatWidget (yüzen sohbet
 * paneli) aynı işletme verisiyle konuşsun diye tek yerden paylaşılır.
 */
export function snapshotSystemMessage(snapshot: unknown): AIMessage {
  return {
    role: 'system',
    content:
      'Sen Elffarma Paket Programı için çalışan bir işletme analisti asistanısın. ' +
      'Aşağıda uygulamanın güncel verilerinden hesaplanmış gerçek bir özet (JSON) var. ' +
      'Sadece bu veriye dayanarak yanıt ver. Veride olmayan sayıları uydurma; ' +
      'eksik bilgi varsa bunu açıkça belirt. SADECE TÜRKÇE yaz — başka bir dilde (Çince, İngilizce vb.) ' +
      'tek kelime bile yazma.\n\nVERİ ÖZETİ:\n' +
      JSON.stringify(snapshot, null, 2),
  }
}
