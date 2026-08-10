// Master talimat §25'teki "Ahmet Atalık hakkında özet çıkar" AI CRM asistanı
// — mevcut chatWithText altyapısını (AIService, provider-agnostic) kullanır.
// Prompt'a SADECE gerçek veriden hesaplanmış alanlar geçilir (uydurma sayı
// yok); AI sadece bu verileri doğal dilde özetler, yeni veri üretmez veya
// CRM kaydını değiştirmez (§25: "AI önerileri kullanıcı onaylamadan kritik
// CRM verisini otomatik değiştirmemeli" — bu fonksiyon zaten salt okunur).
import { chatWithText } from './chat'

export interface DoctorSummaryInput {
  doctorName: string
  specialty: string | null
  hospitalName: string | null
  lastActivityDate: string | null
  lastActivityType: string | null
  lastSaleDate: string | null
  totalSales: number
  balance: number
  openOpportunityTitle: string | null
  nextFollowUpDate: string | null
  overdueVisitCount: number
}

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

function buildPrompt(input: DoctorSummaryInput): string {
  const lines = [
    `Doktor: ${input.doctorName}`,
    input.specialty ? `Uzmanlık: ${input.specialty}` : null,
    input.hospitalName ? `Klinik: ${input.hospitalName}` : null,
    `Son görüşme: ${input.lastActivityDate ?? 'kayıt yok'}${input.lastActivityType ? ` (${input.lastActivityType})` : ''}`,
    `Son sipariş tarihi: ${input.lastSaleDate ?? 'kayıt yok'}`,
    `Toplam satış: ${currency(input.totalSales)}`,
    `Cari bakiye: ${currency(input.balance)}${input.balance > 0 ? ' (borçlu)' : ''}`,
    `Açık fırsat: ${input.openOpportunityTitle ?? 'yok'}`,
    `Sonraki takip tarihi: ${input.nextFollowUpDate ?? 'planlanmadı'}`,
    input.overdueVisitCount > 0 ? `Gecikmiş takip sayısı: ${input.overdueVisitCount}` : null,
  ].filter(Boolean)

  return (
    `Aşağıdaki gerçek CRM verilerine dayanarak bu doktor hakkında 3-4 cümlelik, ` +
    `satış temsilcisinin hızlıca okuyup aksiyon alabileceği kısa bir Türkçe özet yaz. ` +
    `Sadece verilen bilgileri kullan, hiçbir sayı veya tarih uydurma. Varsa önerilen ` +
    `bir sonraki aksiyonu son cümlede belirt.\n\n${lines.join('\n')}`
  )
}

export async function summarizeDoctorForRep(input: DoctorSummaryInput): Promise<string> {
  return chatWithText(buildPrompt(input))
}
