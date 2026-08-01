import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { InstagramLead } from '@/types/database'

export interface InstagramLeadInput {
  full_name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  instagram_username?: string | null
  notes?: string | null
}

export async function fetchInstagramLeads(): Promise<InstagramLead[]> {
  const { data, error } = await supabase.from('instagram_leads').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as InstagramLead[]
}

export async function createInstagramLead(input: InstagramLeadInput): Promise<InstagramLead> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<InstagramLead>(
    'instagram_leads',
    { ...input, created_by: createdBy },
    `Instagram doktoru: ${input.full_name}`,
  )
}

export async function updateInstagramLead(id: string, input: InstagramLeadInput): Promise<InstagramLead> {
  return offlineUpdate<InstagramLead>('instagram_leads', id, { ...input }, `Instagram doktoru güncelleme: ${input.full_name}`)
}

export async function deleteInstagramLead(id: string): Promise<void> {
  return offlineDelete('instagram_leads', id, 'Instagram doktoru silme')
}
