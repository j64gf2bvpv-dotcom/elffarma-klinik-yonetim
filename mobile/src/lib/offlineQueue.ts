// Masaüstündeki src/lib/offlineQueue.ts'in expo-sqlite portu — aynı
// QueuedMutation şekli, aynı public API (enqueueMutation/getQueuedMutations/
// removeQueuedMutation/subscribeQueueChange), sadece depolama IndexedDB yerine
// SQLite (bkz. plan §Tech stack: alan büyüdükçe AsyncStorage'ın her yazımda
// tüm diziyi oku-parse-mutasyon-yaz yapması riskli — bir sahadaki temsilcinin
// saatlerce offline kalıp birden çok kayıt biriktirmesi gerçek senaryo).
//
// createdAt string-sıralaması (aynı milisaniyede aynı anda birden fazla kayıt
// oluşursa gerçek kronolojik sırayı garanti etmeyen bilinen bir davranış)
// masaüstüyle BİLİNÇLİ olarak birebir korunuyor — bkz. plan §Risks.
import * as Crypto from 'expo-crypto'
import * as SQLite from 'expo-sqlite'

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

interface MutationRow {
  id: string
  type: QueuedMutationType
  description: string
  table_name: string | null
  payload: string | null
  match: string | null
  rpc_name: string | null
  rpc_args: string | null
  on_conflict: string | null
  created_at: string
}

const DB_NAME = 'elffarma-offline-queue.db'

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        create table if not exists mutations (
          id text primary key,
          type text not null,
          description text not null,
          table_name text,
          payload text,
          match text,
          rpc_name text,
          rpc_args text,
          on_conflict text,
          created_at text not null
        );
      `)
      return db
    })
  }
  return dbPromise
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

function rowToMutation(row: MutationRow): QueuedMutation {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    table: row.table_name ?? undefined,
    payload: row.payload ? (JSON.parse(row.payload) as Record<string, unknown>) : undefined,
    match: row.match ? (JSON.parse(row.match) as Record<string, unknown>) : undefined,
    rpcName: row.rpc_name ?? undefined,
    rpcArgs: row.rpc_args ? (JSON.parse(row.rpc_args) as Record<string, unknown>) : undefined,
    onConflict: row.on_conflict ?? undefined,
    createdAt: row.created_at,
  }
}

export async function enqueueMutation(
  entry: Omit<QueuedMutation, 'id' | 'createdAt'>,
): Promise<QueuedMutation> {
  const full: QueuedMutation = {
    ...entry,
    id: Crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  const db = await getDb()
  await db.runAsync(
    `insert into mutations
      (id, type, description, table_name, payload, match, rpc_name, rpc_args, on_conflict, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    full.id,
    full.type,
    full.description,
    full.table ?? null,
    full.payload ? JSON.stringify(full.payload) : null,
    full.match ? JSON.stringify(full.match) : null,
    full.rpcName ?? null,
    full.rpcArgs ? JSON.stringify(full.rpcArgs) : null,
    full.onConflict ?? null,
    full.createdAt,
  )
  notifyChange()
  return full
}

export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<MutationRow>('select * from mutations')
  return rows.map(rowToMutation).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function removeQueuedMutation(id: string): Promise<void> {
  const db = await getDb()
  await db.runAsync('delete from mutations where id = ?', id)
  notifyChange()
}
