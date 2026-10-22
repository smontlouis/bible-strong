import { refetchResourceOnReconnect } from './resourceQueryRecovery'

export const localQueryOptions = {
  networkMode: 'always' as const,
}

export const remoteQueryOptions = {
  networkMode: 'online' as const,
}

/** How long resource content stays in memory once no screen shows it. */
export const RESOURCE_QUERY_GC_TIME = 30 * 60 * 1000

// Published resource content only changes with a new revision, which a new launch picks up:
// a successful read is reused for the whole session instead of being read again at each mount
// or return to the foreground. Failed and unavailable reads still recover at those moments and
// on reconnection. The `['resource']` keys get these options by default (see queryClient.ts).
export const staticResourceQueryOptions = {
  staleTime: Infinity,
  gcTime: RESOURCE_QUERY_GC_TIME,
  refetchOnMount: refetchResourceOnReconnect,
  refetchOnWindowFocus: refetchResourceOnReconnect,
  refetchOnReconnect: refetchResourceOnReconnect,
}
