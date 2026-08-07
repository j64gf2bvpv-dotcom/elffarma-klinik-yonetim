// Masaüstünde navigator.onLine + window 'online'/'offline' event'leri üç ayrı
// yerde (useOnlineStatus, offlineMutation, useOfflineSync) bağımsız okunuyordu
// — RN'de navigator.onLine yok, NetInfo abonelik tabanlı (statik bir alan
// değil). Burada TEK bir modül-seviyesi abonelik tutulup senkron isOnline()
// okuması + reaktif abonelik ihtiyacı olan yerlere (useOnlineStatus) tek
// kaynaktan sağlanıyor — plan §Tech stack'te işaret edilen konsolidasyon.
import NetInfo from '@react-native-community/netinfo'

let online = true // ilk NetInfo event'i gelene kadar iyimser varsayım

type Listener = (online: boolean) => void
const listeners = new Set<Listener>()

NetInfo.addEventListener((state) => {
  online = state.isConnected === true && state.isInternetReachable !== false
  for (const listener of listeners) listener(online)
})

export function isOnline(): boolean {
  return online
}

export function subscribeOnlineStatus(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
