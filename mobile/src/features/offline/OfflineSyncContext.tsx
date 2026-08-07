import * as React from 'react'
import { useOfflineSync } from './useOfflineSync'

interface OfflineSyncValue {
  pendingCount: number
  syncing: boolean
}

const OfflineSyncContext = React.createContext<OfflineSyncValue>({ pendingCount: 0, syncing: false })

/**
 * useOfflineSync() kuyruğu flush eden bir efekt barındırıyor — TEK bir yerde
 * (uygulama kökünde) çağrılmalı, aksi halde birden fazla ekran aynı anda
 * flush denerse aynı kuyruk kaydı iki kez uygulanabilir (her hook örneğinin
 * kendi flushingRef'i var, aralarında paylaşım yok). Ekranlar bekleyen kayıt
 * sayısını göstermek için bu context'i (useOfflineSyncStatus) okur.
 */
export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const { pendingCount, syncing } = useOfflineSync()
  const value = React.useMemo(() => ({ pendingCount, syncing }), [pendingCount, syncing])
  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>
}

export function useOfflineSyncStatus(): OfflineSyncValue {
  return React.useContext(OfflineSyncContext)
}
