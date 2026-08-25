import type { QueryClient } from '@tanstack/react-query'

import { getOfflineCopyInvalidationKeys, type OfflineCopyIdentity } from './offlineCopy'
import { queryClient } from './queryClient'

export const invalidateOfflineCopyQueries = async (
  identity: OfflineCopyIdentity,
  client: Pick<QueryClient, 'invalidateQueries'> = queryClient
): Promise<void> => {
  await Promise.all(
    getOfflineCopyInvalidationKeys(identity).map(queryKey => client.invalidateQueries({ queryKey }))
  )
}
