import { supabase } from '@/lib/supabaseClient'
import type { Congress, CongressParticipant } from '@shared/types/database'

export async function fetchCongresses(): Promise<Congress[]> {
  const { data, error } = await supabase
    .from('congresses')
    .select('*')
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(100)
  if (error) throw error
  return data as Congress[]
}

export async function fetchCongress(id: string): Promise<{ congress: Congress; participants: CongressParticipant[] }> {
  const [congressRes, participantsRes] = await Promise.all([
    supabase.from('congresses').select('*').eq('id', id).single(),
    supabase.from('congress_participants').select('*').eq('congress_id', id).order('doctor_name', { ascending: true }),
  ])
  if (congressRes.error) throw congressRes.error
  if (participantsRes.error) throw participantsRes.error
  return { congress: congressRes.data as Congress, participants: participantsRes.data as CongressParticipant[] }
}
