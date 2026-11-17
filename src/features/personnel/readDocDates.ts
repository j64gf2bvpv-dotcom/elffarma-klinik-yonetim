import { readBillText } from '@/features/bills/readBill'
import { parseDocDates, type DocDates } from './docDates'

/** Resim (yazı tanıma) ya da PDF'ten tarihleri ve metni okur */
export async function readDocDates(file: File): Promise<DocDates & { text: string }> {
  const text = await readBillText(file)
  return { ...parseDocDates(text), text }
}
