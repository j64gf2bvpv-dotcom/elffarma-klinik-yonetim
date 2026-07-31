import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { CustomerFile } from '@/types/database'

export async function fetchCustomerFiles(customerId: string): Promise<CustomerFile[]> {
  const { data, error } = await supabase
    .from('customer_files')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as CustomerFile[]
}

export async function uploadCustomerFile(customerId: string, file: File): Promise<CustomerFile> {
  const path = `${customerId}/${Date.now()}-${file.name}`
  const { error: uploadError } = await supabase.storage.from('customer-files').upload(path, file)
  if (uploadError) throw uploadError
  const uploadedBy = await getCurrentUserId()
  return offlineInsert<CustomerFile>(
    'customer_files',
    { customer_id: customerId, file_name: file.name, file_path: path, uploaded_by: uploadedBy },
    `Dosya: ${file.name}`,
  )
}

export async function deleteCustomerFile(id: string, filePath: string): Promise<void> {
  await supabase.storage.from('customer-files').remove([filePath])
  return offlineDelete('customer_files', id, 'Dosya silme')
}

export async function getCustomerFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('customer-files').createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}
