import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { InstagramLead } from '@shared/types/database'

export interface CreateLeadInput {
  full_name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  instagram_username?: string | null
  notes?: string | null
}

export async function fetchInstagramLeads(): Promise<InstagramLead[]> {
  const { data, error } = await supabase
    .from('instagram_leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return data as InstagramLead[]
}

export async function createInstagramLead(input: CreateLeadInput): Promise<InstagramLead> {
  const userId = await getCurrentUserId()
  return offlineInsert<InstagramLead>('instagram_leads', { ...input, created_by: userId }, `Lead: ${input.full_name}`)
}

export async function deleteInstagramLead(id: string): Promise<void> {
  return offlineDelete('instagram_leads', id, 'Lead silme')
}
