import { supabase } from '@/lib/supabaseClient'
import { offlineUpsert, offlineDelete } from '@/lib/offlineMutation'
import type { WhatsAppTemplate } from '@/types/database'

export async function fetchTemplates(): Promise<WhatsAppTemplate[]> {
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as WhatsAppTemplate[]
}

export async function upsertTemplate(
  template: Pick<WhatsAppTemplate, 'id' | 'name' | 'body'> | Omit<WhatsAppTemplate, 'id' | 'created_at' | 'updated_at'>,
): Promise<WhatsAppTemplate> {
  const payload = 'id' in template ? template : { ...template, id: crypto.randomUUID() }
  return offlineUpsert<WhatsAppTemplate>('whatsapp_templates', { ...payload }, `Şablon: ${template.name}`)
}

export async function deleteTemplate(id: string): Promise<void> {
  return offlineDelete('whatsapp_templates', id, 'Şablon silme')
}
