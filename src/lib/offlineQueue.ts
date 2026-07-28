// Bağlantı yokken yapılan ekleme/güncelleme/silme işlemlerini yerelde (IndexedDB)
// saklayan kuyruk. Bağlantı geri gelince useOfflineSync bu kuyruğu sırayla
// Supabase'e gönderir. Hiçbir işlem sessizce kaybolmaz — başarısız olursa
// kuyrukta kalır ve kullanıcıya bildirilir.

export type QueuedMutationType = 'insert' | 'update' | 'delete' | 'rpc' | 'upsert'

export interface QueuedMutation {
  id: string
  type: QueuedMutationType
  description: string
  table?: string
  payload?: Record<string, unknown>
  match?: Record<string, unknown>
  rpcName?: string
  rpcArgs?: Record<string, unknown>
  onConflict?: string
  createdAt: string
}

const DB_NAME = 'elffarma-offline-queue'
const STORE_NAME = 'mutations'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

type Listener = () => void
const listeners = new Set<Listener>()

function notifyChange() {
  for (const listener of listeners) listener()
}

export function subscribeQueueChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function enqueueMutation(
  entry: Omit<QueuedMutation, 'id' | 'createdAt'>,
): Promise<QueuedMutation> {
  const full: QueuedMutation = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(full)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  notifyChange()
  return full
}

export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => {
      const rows = (request.result as QueuedMutation[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      resolve(rows)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function removeQueuedMutation(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  notifyChange()
}
