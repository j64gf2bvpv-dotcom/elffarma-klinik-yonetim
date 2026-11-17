import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete } from '@/lib/offlineMutation'
import { removeDocuments, uploadDocumentAttachment } from '@/lib/documentAttachments'
import { resizeImageFile } from '@/lib/resizeImage'
import type { Personnel, PersonnelDocument } from '@/types/database'
import { formatPersonName, formatPhoneTR } from '@/lib/personFormat'

export type PersonnelInput = Omit<Personnel, 'id' | 'created_by' | 'created_at' | 'updated_at'>
export type PersonnelDocumentInput = Omit<PersonnelDocument, 'id' | 'created_by' | 'created_at' | 'updated_at'>

export async function fetchPersonnel(): Promise<Personnel[]> {
  const { data, error } = await supabase.from('personnel').select('*').order('full_name', { ascending: true })
  if (error) throw error
  return data as Personnel[]
}

export async function fetchPersonnelDocuments(personnelId?: string): Promise<PersonnelDocument[]> {
  let q = supabase.from('personnel_documents').select('*').order('created_at', { ascending: true })
  if (personnelId) q = q.eq('personnel_id', personnelId)
  const { data, error } = await q
  if (error) throw error
  return data as PersonnelDocument[]
}

/** Ad "Ad SOYAD", telefonlar "0532 123 45 67" düzeninde kaydedilir (bkz. lib/personFormat) */
function tidy<T extends Partial<PersonnelInput>>(input: T): T {
  const out = { ...input }
  if (out.full_name) out.full_name = formatPersonName(out.full_name)
  if (out.phone) out.phone = formatPhoneTR(out.phone)
  if (out.emergency_contact_phone) out.emergency_contact_phone = formatPhoneTR(out.emergency_contact_phone)
  return out
}

export async function createPersonnel(input: PersonnelInput): Promise<Personnel> {
  const body = tidy(input)
  return offlineInsert<Personnel>('personnel', { ...body }, `Personel: ${body.full_name}`)
}

export async function updatePersonnel(id: string, input: Partial<PersonnelInput>): Promise<Personnel> {
  return offlineUpdate<Personnel>('personnel', id, { ...tidy(input) }, 'Personel güncelleme')
}

/** Personeli ve bütün evrak dosyalarını siler */
export async function deletePersonnel(person: Personnel, docs: PersonnelDocument[]): Promise<void> {
  await offlineDelete('personnel', person.id, `Personel silme: ${person.full_name}`)
  await removeDocuments([...docs.flatMap((d) => d.attachment_paths), ...(person.photo_path ? [person.photo_path] : [])])
}

export async function savePersonnelDocument(id: string | undefined, input: PersonnelDocumentInput): Promise<PersonnelDocument> {
  return id
    ? offlineUpdate<PersonnelDocument>('personnel_documents', id, { ...input }, 'Personel evrakı güncelleme')
    : offlineInsert<PersonnelDocument>('personnel_documents', { ...input }, 'Personel evrakı')
}

export async function deletePersonnelDocument(doc: PersonnelDocument): Promise<void> {
  await offlineDelete('personnel_documents', doc.id, 'Personel evrakı silme')
  await removeDocuments(doc.attachment_paths)
}

export const uploadPersonnelAttachment = (personnelId: string, file: File) => uploadDocumentAttachment(file, `personnel/${personnelId}`)

/** Vesikalık fotoğraf — küçük JPEG */
export async function uploadPersonnelPhoto(personnelId: string, file: File): Promise<string> {
  const blob = await resizeImageFile(file, 600, 0.88)
  const path = `personnel/${personnelId}/foto-${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('documents').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return path
}
