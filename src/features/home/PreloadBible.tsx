import React, { PropsWithChildren } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import { isVersionInstalled } from '~helpers/biblesDb'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import { isOnboardingCompletedAtom } from '~features/onboarding/atom'
import { localQueryOptions } from '~helpers/queryOptions'

const PreloadBible = ({ children }: PropsWithChildren) => {
  const isOnboardingCompleted = useAtomValue(isOnboardingCompletedAtom)
  const version = useDefaultBibleVersion()

  // Check if the Bible version is available (SQLite or JSON)
  const preloadQuery = useQuery({
    queryKey: ['preload-bible', isOnboardingCompleted, version],
    queryFn: async () => {
      if (!isOnboardingCompleted) return null
      const installed = await isVersionInstalled(version)
      if (installed) return true
      const needsDownload = await getIfVersionNeedsDownload(version)
      return needsDownload ? null : true
    },
    ...localQueryOptions,
  })

  if (!isOnboardingCompleted || !preloadQuery.isSuccess) {
    return (
      <Box height={50}>
        <Loading />
      </Box>
    )
  }

  return children
}

export default PreloadBible
