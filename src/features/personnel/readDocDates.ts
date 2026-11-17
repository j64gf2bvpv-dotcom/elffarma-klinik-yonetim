import { readBillText } from '@/features/bills/readBill'
import { parseDocDates, type DocDates } from './docDates'

/** Resim (yazı tanıma) ya da PDF'ten tarihleri okur */
export async function readDocDates(file: File): Promise<DocDates> {
  return parseDocDates(await readBillText(file))
}
