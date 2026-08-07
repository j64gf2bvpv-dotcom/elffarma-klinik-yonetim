import * as React from 'react'
import Toast from 'react-native-toast-message'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import {
  getQueuedMutations,
  removeQueuedMutation,
  subscribeQueueChange,
  type QueuedMutation,
} from '@/lib/offlineQueue'
import { isOnline, subscribeOnlineStatus } from '@/lib/netInfoState'

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
 * Masaüstündeki src/features/offline/useOfflineSync.ts'in RN portu — aynı
 * sıralı flush + ilk hatada durma (skip etmeme) semantiği. navigator.onLine /
 * window 'online' event'i yerine netInfoState'in tek konsolide aboneliği
 * kullanılıyor.
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
    if (flushingRef.current || !isOnline()) return
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
        Toast.show({
          type: 'error',
          text1: 'Bazı bekleyen kayıtlar gönderilemedi',
          text2: 'Bağlantı sağlandığında otomatik olarak tekrar denenecek.',
        })
      } else if (syncedCount > 0) {
        Toast.show({ type: 'success', text1: `${syncedCount} bekleyen kayıt senkronize edildi` })
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
    if (isOnline()) flush()
    return subscribeOnlineStatus((online) => {
      if (online) flush()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { pendingCount, syncing, flush }
}
