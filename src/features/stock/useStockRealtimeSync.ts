import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

/**
 * Ürün/stok verisi tek bir paylaşımlı veritabanında tutuluyor ama istemci
 * tarafında önbelleğe alınıyor (TanStack Query, staleTime 30sn) — bir
 * kullanıcının değişikliği, o an ekranı açık olan başka bir kullanıcıda
 * ancak doğal bir yeniden-sorgu tetiklenince (pencere odağı, 30sn+ sonra,
 * sayfa değiştirme) görünüyordu. Kullanıcı isteğiyle (2026-08-24) — "bütün
 * kullanıcılarda stoklar/ürünler ortak olmalı, değişiklik yapıldığında her
 * kullanıcıya yansımalı" — products/stock_movements/stock_count_items/
 * stock_counts tabloları supabase_realtime publication'ına eklenip (bkz.
 * migration) buradan Postgres Changes ile dinleniyor; herhangi bir satır
 * ekleme/güncelleme/silme olayında ilgili sorgular hemen invalidate edilip
 * TÜM açık istemcilerde anında tazeleniyor — presence kanalından (sadece
 * kimin çevrimiçi olduğunu bildiren, ayrı bir Realtime özelliği) tamamen
 * bağımsız, AppShell'e (her oturumda bir kez) bağlanır.
 */
export function useStockRealtimeSync() {
  const queryClient = useQueryClient()

  React.useEffect(() => {
    const channel = supabase
      .channel('stock-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        queryClient.invalidateQueries({ queryKey: ['products'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, () => {
        queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_count_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['stock_count_items'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_counts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['stock_counts'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
