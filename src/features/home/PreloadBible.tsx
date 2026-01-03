import React, { PropsWithChildren } from 'react'
import { useAtomValue } from 'jotai/react'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import loadBible from '~helpers/loadBible'
import useAsync from '~helpers/useAsync'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import { isOnboardingCompletedAtom } from '~features/onboarding/atom'

const PreloadBible = ({ children }: PropsWithChildren<{}>) => {
  const isOnboardingCompleted = useAtomValue(isOnboardingCompletedAtom)
  const version = useDefaultBibleVersion()

  // Wait for onboarding to complete before attempting to load Bible
  const { status } = useAsync(async () => {
    if (!isOnboardingCompleted) {
      return null // Don't load if onboarding not completed
    }
    return loadBible(version)
  }, [isOnboardingCompleted, version])

  // Show loading if onboarding not completed or Bible is still loading
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
