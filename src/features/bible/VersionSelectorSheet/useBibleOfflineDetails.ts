import { useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import React from 'react'

import type { SheetRef } from '~common/sheet'
import type { Version } from '~helpers/bibleVersions'
import { isStrongCapableBibleVersion } from '~helpers/strongBiblePublications'
import { isInterlinearCapableBibleVersion } from '~helpers/interlinearBiblePublications'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { getLanguage } from '~i18n'
import { installedVersionsSignalAtom } from '~state/app'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
import {
  getBibleOfflineDetailsQueryKey,
  getInterlinearOfflineDetailsQueryKey,
  getStrongOfflineDetailsQueryKey,
} from './bibleOfflineDetailsQueryKeys'

export const useBibleOfflineDetails = () => {
  const sheetRef = React.useRef<SheetRef>(null)
  const openRequestRef = React.useRef(0)
  const [version, setVersion] = React.useState<(Version & { displayName?: string }) | undefined>()
  const queryClient = useQueryClient()
  const resources = useResourceAccess()
  const installedSignal = useAtomValue(installedVersionsSignalAtom)
  const completionSignal = useAtomValue(downloadCompletionSignalAtom)

  const open = async (nextVersion: Version & { displayName?: string }) => {
    const requestId = openRequestRef.current + 1
    openRequestRef.current = requestId
    const preloadTasks: Promise<unknown>[] = [
      queryClient.ensureQueryData({
        queryKey: getBibleOfflineDetailsQueryKey(nextVersion.id, installedSignal, completionSignal),
        queryFn: () =>
          resources.offlineCopies.isAvailable({
            kind: 'bible',
            versionId: nextVersion.id,
          }),
      }),
    ]

    if (isStrongCapableBibleVersion(nextVersion.id)) {
      const strongVersionId = nextVersion.id
      preloadTasks.push(
        queryClient.ensureQueryData({
          queryKey: getStrongOfflineDetailsQueryKey(
            strongVersionId,
            installedSignal,
            completionSignal
          ),
          queryFn: () => resources.offlineCopies.getStrongBibleAvailability(strongVersionId),
        })
      )
    }

    if (isInterlinearCapableBibleVersion(nextVersion.id)) {
      const language = getLanguage()
      preloadTasks.push(
        queryClient.ensureQueryData({
          queryKey: getInterlinearOfflineDetailsQueryKey(
            language,
            installedSignal,
            completionSignal
          ),
          queryFn: () =>
            resources.offlineCopies.isAvailable({
              kind: 'interlinear-index',
              versionId: 'BHG',
              language,
            }),
        })
      )
    }

    await Promise.allSettled(preloadTasks)
    if (requestId !== openRequestRef.current) return

    setVersion(nextVersion)
    requestAnimationFrame(() => sheetRef.current?.present())
  }

  return { sheetRef, version, open }
}
