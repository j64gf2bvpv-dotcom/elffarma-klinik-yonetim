import * as React from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import {
  getQueuedMutations,
  removeQueuedMutation,
  subscribeQueueChange,
  type QueuedMutation,
} from '@/lib/offlineQueue'

async function applyMutation(m: QueuedMutation) {
  if (m.type === 'insert') {
    const { error } = await supabase.from(m.table as string).insert(m.payload ?? {})
    if (error) throw error
  } else if (m.type === 'update') {
    const { error } = await supabase
      .from(m.table as string)
      .update(m.payload ?? {})
      .eq('id', (m.match as { id: string }).id)
    if (error) throw error
  } else if (m.type === 'delete') {
    const { error } = await supabase
      .from(m.table as string)
      .delete()
      .eq('id', (m.match as { id: string }).id)
    if (error) throw error
  } else if (m.type === 'upsert') {
    const { error } = await supabase
      .from(m.table as string)
      .upsert(m.payload ?? {}, m.onConflict ? { onConflict: m.onConflict } : undefined)
    if (error) throw error
  } else if (m.type === 'rpc') {
    const { error } = await supabase.rpc(m.rpcName as string, m.rpcArgs)
    if (error) throw error
  }
}

/**
 * Bağlantı yokken kuyruğa alınan işlemleri bağlantı gelince sırayla Supabase'e
 * gönderir. Bir işlem başarısız olursa (ör. gerçek bir doğrulama hatası) durur —
 * sıradaki işlemler öncekine bağımlı olabileceğinden atlamak yerine bekletir ve
 * kullanıcıyı bilgilendirir.
 */
export function useOfflineSync() {
  const queryClient = useQueryClient()
  const [pendingCount, setPendingCount] = React.useState(0)
  const [syncing, setSyncing] = React.useState(false)
  const flushingRef = React.useRef(false)

  const refreshCount = React.useCallback(async () => {
    const list = await getQueuedMutations()
    setPendingCount(list.length)
  }, [])

  const flush = React.useCallback(async () => {
    if (flushingRef.current || !navigator.onLine) return
    flushingRef.current = true
    setSyncing(true)
    try {
      const list = await getQueuedMutations()
      let syncedCount = 0
      let failed = false
      for (const m of list) {
        try {
          await applyMutation(m)
          await removeQueuedMutation(m.id)
          syncedCount++
        } catch (error) {
          failed = true
          console.error('[OfflineSync] Kuyruktaki işlem gönderilemedi, kuyrukta kalıyor:', m, error)
          break
        }
      }
      await refreshCount()
      if (failed) {
        toast.error('Bazı bekleyen kayıtlar gönderilemedi', {
          description: 'Bağlantı sağlandığında otomatik olarak tekrar denenecek.',
        })
      } else if (syncedCount > 0) {
        toast.success(`${syncedCount} bekleyen kayıt senkronize edildi`)
        queryClient.invalidateQueries()
      }
    } finally {
      flushingRef.current = false
      setSyncing(false)
    }
  }, [queryClient, refreshCount])

  React.useEffect(() => {
    refreshCount()
    return subscribeQueueChange(refreshCount)
  }, [refreshCount])

  React.useEffect(() => {
    if (navigator.onLine) flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { pendingCount, syncing, flush }
}
