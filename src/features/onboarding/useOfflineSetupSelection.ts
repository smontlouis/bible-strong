import { useEffect, useState } from 'react'

import { isLocalResourceAvailable } from '~features/resources/resourceAvailability'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import {
  bundledOfflineResourceSizeManifest,
  loadOfflineResourceSizeManifest,
} from '~helpers/offlineResourceSizeManifest'
import {
  createDownloadItemFromOnboardingSelection,
  getOnboardingResourceIdentity,
  getOnboardingResourceSelectionId,
} from './onboardingResources'
import {
  getDefaultOfflineSetupFolderOptionIds,
  getOfflineSetupLockedOptionIds,
  resolveOfflineSetupFolderOptionIds,
  toggleOfflineSetupFolderOption,
  type OfflineSetupFolderId,
  type OfflineSetupFolderOptionIds,
  type OfflineSetupOption,
} from './offlineSetupPresets'
import { getOfflineSetupSizeSummary } from './offlineSetupSizeSummary'
import { getOfflineSetupReviewItems } from './offlineSetupReview'

type AvailabilitySummary = {
  ids: Set<string>
}

const summarizeAvailableSelections = (
  selections: ReturnType<typeof resolveOfflineSetupFolderOptionIds>
): AvailabilitySummary =>
  selections.reduce<AvailabilitySummary>(
    (summary, selection) => {
      summary.ids.add(getOnboardingResourceSelectionId(selection))
      return summary
    },
    { ids: new Set() }
  )

const checkAvailability = async (
  folderOptionIds: OfflineSetupFolderOptionIds,
  lang: ResourceLanguage
): Promise<AvailabilitySummary> => {
  const selections = resolveOfflineSetupFolderOptionIds(folderOptionIds, lang)
  const results = await Promise.all(
    selections.map(async selection => ({
      selection,
      available: await isLocalResourceAvailable(getOnboardingResourceIdentity(selection)),
    }))
  )

  return summarizeAvailableSelections(
    results.filter(result => result.available).map(result => result.selection)
  )
}

const useOfflineSetupSelection = (lang: ResourceLanguage) => {
  const [folderOptionIds, setFolderOptionIds] = useState<OfflineSetupFolderOptionIds>(() =>
    getDefaultOfflineSetupFolderOptionIds(lang)
  )
  const [sizeManifest, setSizeManifest] = useState(bundledOfflineResourceSizeManifest)
  const [availability, setAvailability] = useState<AvailabilitySummary>({
    ids: new Set(),
  })
  const [checkedSelectionKey, setCheckedSelectionKey] = useState<string>()
  const selectionKey = JSON.stringify(folderOptionIds)
  const selections = resolveOfflineSetupFolderOptionIds(folderOptionIds, lang)
  const lockedOptionIds = getOfflineSetupLockedOptionIds(folderOptionIds, lang)
  const selectedItems = selections.map(createDownloadItemFromOnboardingSelection)
  const sizeSummary = getOfflineSetupSizeSummary(selectedItems, sizeManifest)
  const reviewItems = getOfflineSetupReviewItems(selections, sizeManifest)
  const missingSelections = selections.filter(
    selection => !availability.ids.has(getOnboardingResourceSelectionId(selection))
  )

  useEffect(() => {
    let cancelled = false
    void loadOfflineResourceSizeManifest().then(manifest => {
      if (!cancelled) setSizeManifest(manifest)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const snapshot = JSON.parse(selectionKey) as OfflineSetupFolderOptionIds

    void checkAvailability(snapshot, lang)
      .then(summary => {
        if (cancelled) return
        setAvailability(summary)
        setCheckedSelectionKey(selectionKey)
      })
      .catch(() => {
        if (cancelled) return
        setAvailability({ ids: new Set() })
        setCheckedSelectionKey(selectionKey)
      })

    return () => {
      cancelled = true
    }
  }, [lang, selectionKey])

  const toggleOption = (folderId: OfflineSetupFolderId, option: OfflineSetupOption) => {
    setFolderOptionIds(current => toggleOfflineSetupFolderOption(current, folderId, option, lang))
  }

  return {
    availabilityReady: checkedSelectionKey === selectionKey,
    downloadBytes: sizeSummary.downloadBytes,
    folderOptionIds,
    installedBytes: sizeSummary.installedBytes,
    lockedOptionIds,
    missingSelections,
    reviewItems,
    selections,
    sizeManifest,
    toggleOption,
  }
}

export default useOfflineSetupSelection
