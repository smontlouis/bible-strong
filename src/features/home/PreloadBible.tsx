import React, { PropsWithChildren } from 'react'
import { useAtomValue } from 'jotai/react'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import loadBible from '~helpers/loadBible'
import useAsync from '~helpers/useAsync'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import { isOnboardingRequiredAtom } from '~features/onboarding/atom'

const PreloadBible = ({ children }: PropsWithChildren<{}>) => {
  const isOnboardingRequired = useAtomValue(isOnboardingRequiredAtom)
  const version = useDefaultBibleVersion()

  // Wait for onboarding check to complete before attempting to load Bible
  const { status } = useAsync(async () => {
    if (isOnboardingRequired !== false) {
      return null // Don't load if onboarding check pending or required
    }
    return loadBible(version)
  }, [isOnboardingRequired, version])

  // Show loading if onboarding check is pending/required or Bible is still loading
  if (isOnboardingRequired !== false || status !== 'Resolved') {
    return (
      <Box height={50}>
        <Loading />
      </Box>
    )
  }

  return children
}

export default PreloadBible
