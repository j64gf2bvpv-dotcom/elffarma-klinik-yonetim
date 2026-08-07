import * as React from 'react'
import { isOnline, subscribeOnlineStatus } from '@/lib/netInfoState'

export function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState(isOnline())
  React.useEffect(() => subscribeOnlineStatus(setOnline), [])
  return online
}
