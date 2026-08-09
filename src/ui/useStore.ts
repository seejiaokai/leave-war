import { useSyncExternalStore } from 'react'
import { getVersion, subscribe } from '../state/store'

/** Re-renders the caller whenever the store changes. Components then re-read
 *  `getState()` directly rather than holding a copy that can go stale. */
export function useVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion)
}
