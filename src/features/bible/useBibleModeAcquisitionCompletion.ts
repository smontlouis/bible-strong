import { useEffect, useEffectEvent } from 'react'
import { useAtomValue } from 'jotai/react'

import {
  applyBibleModeAcquisitionOutcome,
  getBibleModeAcquisitionQueueOutcome,
  verifyBibleModeAcquisition,
  type PendingBibleModeAcquisition,
} from '~helpers/bibleModeAcquisition'
import { downloadItemStatesAtom } from '~state/downloadQueue'
import { useResourceAccess } from '~features/resources/resourceAccess'

export const useBibleModeAcquisitionCompletion = ({
  acquisition,
  finish,
  onSucceeded,
}: {
  acquisition?: PendingBibleModeAcquisition
  finish: (succeeded: boolean) => void
  onSucceeded: (acquisition: PendingBibleModeAcquisition) => void
}) => {
  const downloadStates = useAtomValue(downloadItemStatesAtom)
  const resources = useResourceAccess()
  const finishAcquisition = useEffectEvent(finish)
  const handleSucceeded = useEffectEvent(onSucceeded)

  useEffect(() => {
    if (!acquisition) return
    const outcome = getBibleModeAcquisitionQueueOutcome(acquisition, downloadStates)
    if (outcome === 'waiting') return
    if (outcome === 'failed') {
      finishAcquisition(false)
      return
    }

    let cancelled = false
    verifyBibleModeAcquisition(acquisition, {
      getStrongAvailability: resources.strongBible.getAvailability,
      getInterlinearAvailability: resources.lexiconBible.getInterlinearAvailability,
    })
      .then(ready => {
        if (cancelled) return
        applyBibleModeAcquisitionOutcome(acquisition, ready, {
          finish: finishAcquisition,
          onSucceeded: handleSucceeded,
        })
      })
      .catch(() => {
        if (!cancelled) finishAcquisition(false)
      })

    return () => {
      cancelled = true
    }
  }, [acquisition, downloadStates])
}
