// Masaüstündeki Bütçe Yılı modülünün Faz 1 alt kümesi — Dashboard'daki
// "Aylık Hedef" ilerleme kartı için sadece içinde bulunulan ay/yılın ciro
// hedefini okur (salt okunur; hedef belirleme masaüstünde kalıyor).
import { supabase } from '@/lib/supabaseClient'

export async function fetchCurrentMonthTarget(): Promise<number | null> {
  const now = new Date()
  const { data, error } = await supabase
    .from('budget_targets')
    .select('target_revenue')
    .eq('year', now.getFullYear())
    .eq('month', now.getMonth() + 1)
    .maybeSingle()
  if (error) throw error
  return data ? Number(data.target_revenue) : null
}
