import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isLocalResourceAvailable } from '~features/resources/resourceAvailability'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import {
  bundledOfflineResourceSizeManifest,
  loadOfflineResourceSizeManifest,
} from '~helpers/offlineResourceSizeManifest'
import {
  getOnboardingResourceIdentity,
  getOnboardingResourceDisplayName,
  getOnboardingResourceSelectionId,
} from './onboardingResources'
import {
  getDefaultOfflineSetupFolderOptionIds,
  getOfflineSetupLockedOptionIds,
  OFFLINE_SETUP_FOLDER_IDS,
  resolveOfflineSetupFolderSelections,
  resolveOfflineSetupFolderOptionIds,
  toggleOfflineSetupFolderOption,
  type OfflineSetupFolderId,
  type OfflineSetupFolderOptionIds,
  type OfflineSetupOption,
} from './offlineSetupPresets'
import {
  getOfflineSetupReviewItems,
  getOfflineSetupReviewSummary,
  type OfflineSetupReviewSummary,
} from './offlineSetupReview'

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
  const { t } = useTranslation()
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
  const getDisplayName = (selection: Parameters<typeof getOnboardingResourceDisplayName>[0]) =>
    getOnboardingResourceDisplayName(selection, lang, (key, options) => t(key, options))
  const reviewSummary = getOfflineSetupReviewSummary(
    getOfflineSetupReviewItems(selections, sizeManifest, getDisplayName)
  )
  const folderReviewSummaries = Object.fromEntries(
    OFFLINE_SETUP_FOLDER_IDS.map(folderId => {
      const folderSelections = resolveOfflineSetupFolderSelections(
        folderId,
        folderOptionIds[folderId],
        lang
      )
      const folderItems = getOfflineSetupReviewItems(folderSelections, sizeManifest, getDisplayName)
      return [folderId, getOfflineSetupReviewSummary(folderItems)]
    })
  ) as Record<OfflineSetupFolderId, OfflineSetupReviewSummary>
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
    folderOptionIds,
    folderReviewSummaries,
    lockedOptionIds,
    missingSelections,
    reviewSummary,
    selections,
    sizeManifest,
    toggleOption,
  }
}

export default useOfflineSetupSelection
