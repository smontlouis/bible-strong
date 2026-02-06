import React, { PropsWithChildren } from 'react'
import { useAtomValue } from 'jotai/react'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import { isVersionInstalled } from '~helpers/biblesDb'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import useAsync from '~helpers/useAsync'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import { isOnboardingCompletedAtom } from '~features/onboarding/atom'

const PreloadBible = ({ children }: PropsWithChildren<{}>) => {
  const isOnboardingCompleted = useAtomValue(isOnboardingCompletedAtom)
  const version = useDefaultBibleVersion()

  // Check if the Bible version is available (SQLite or JSON)
  const { status } = useAsync(async () => {
    if (!isOnboardingCompleted) {
      return null
    }
    // Check SQLite first, then fallback to file check
    const installed = await isVersionInstalled(version)
    if (installed) return true
    const needsDownload = await getIfVersionNeedsDownload(version)
    if (needsDownload) return null
    return true
  }, [isOnboardingCompleted, version])

  if (!isOnboardingCompleted || status !== 'Resolved') {
    return (
      <Box height={50}>
        <Loading />
      </Box>
    )
  }

  return children
}

export default PreloadBible
