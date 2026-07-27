import { useAtomValue } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type RefObject } from 'react'
import { Alert, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'

import { Sheet, SheetHeader, type SheetRef } from '~common/sheet'
import { SheetView } from '~common/sheet-expo-ui'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { downloadManager } from '~helpers/downloadManager'
import { getInterlinearLocalePriority } from '~helpers/interlinearDisplayMode'
import { getInterlinearSidecarAvailability } from '~helpers/interlinearBibleSidecar'
import {
  createStrongModeDownloadPlan,
  getDownloadPlanEstimatedSize,
  type InterlinearAvailabilityCandidate,
} from '~helpers/strongModeDownloadPlan'
import {
  getStrongBibleSidecarAvailability,
  type StrongBibleSidecarAvailability,
} from '~helpers/strongBibleSidecar'
import {
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
  type StrongMode,
} from '~helpers/strongBiblePublications'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import useLanguage from '~helpers/useLanguage'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
import { useBibleTabActions, type BibleTab } from '~state/tabs'

import BibleDisplayModeCard from './BibleDisplayModeCard'
import {
  getConfirmedStrongModeDownloadIds,
  getDownloadPlanPresentation,
} from './strongModeDownloadState'

type Props = {
  bibleAtom: PrimitiveAtom<BibleTab>
  sheetRef: RefObject<SheetRef | null>
}

type AvailabilityState = {
  strong?: StrongBibleSidecarAvailability
  interlinear: InterlinearAvailabilityCandidate[]
}

const readStrongAvailability = async (
  version: string
): Promise<StrongBibleSidecarAvailability | undefined> => {
  if (!isStrongCapableBibleVersion(version)) return
  return getStrongBibleSidecarAvailability(version as StrongBibleVersionId)
}

const readInterlinearAvailabilities = async (
  version: string,
  appLanguage: ResourceLanguage
): Promise<InterlinearAvailabilityCandidate[]> => {
  if (!isStrongCapableBibleVersion(version)) return []
  const localePriority = getInterlinearLocalePriority(appLanguage)
  const results = await Promise.allSettled(
    localePriority.map(locale =>
      getInterlinearSidecarAvailability(locale).then(sidecarAvailability => ({
        locale,
        availability: sidecarAvailability,
      }))
    )
  )
  return results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []))
}

const StrongModeSelectorSheet = ({ bibleAtom, sheetRef }: Props) => {
  const { t } = useTranslation()
  const appLanguage = useLanguage()
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const selectedMode = bible.data.strongMode ?? 'hidden'
  const version = bible.data.selectedVersion
  const bibleDownload = useDownloadItemStatus(`bible:${version}`)
  const strongDownload = useDownloadItemStatus(`bible-strong:${version}`)
  const bhgDownload = useDownloadItemStatus('bible:BHG')
  const frenchInterlinearDownload = useDownloadItemStatus('bible-interlinear:BHG:fr')
  const englishInterlinearDownload = useDownloadItemStatus('bible-interlinear:BHG:en')
  const [downloadPlanIds, setDownloadPlanIds] = useState<
    Partial<Record<Exclude<StrongMode, 'hidden'>, string[]>>
  >({})
  const [modeAwaitingSelection, setModeAwaitingSelection] = useState<
    Exclude<StrongMode, 'hidden'> | undefined
  >(bible.data.pendingStrongModeVersionId === version ? bible.data.pendingStrongMode : undefined)
  const isHebrew = bible.data.selectedBook.Numero <= 39
  const originalPreview = isHebrew ? 'אֱלֹהִים' : 'θεός'
  const translationPreview = appLanguage === 'fr' ? 'Dieu' : 'God'
  const transliterationPreview = isHebrew ? 'Elohim' : 'theos'
  const morphologyPreview = isHebrew ? 'HNcmpa' : 'GNcmsn'
  const strongPreview = isHebrew ? 'H0430' : 'G2316'
  const serifFontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif'

  const { data: availability = { interlinear: [] } } = useQuery<AvailabilityState>({
    queryKey: [
      'strong-mode-availability',
      version,
      appLanguage,
      downloadCompletionSignal,
      bhgDownload?.status,
      englishInterlinearDownload?.status,
      frenchInterlinearDownload?.status,
      strongDownload?.status,
    ],
    queryFn: async () => {
      const [strongResult, interlinearResult] = await Promise.allSettled([
        readStrongAvailability(version),
        readInterlinearAvailabilities(version, appLanguage),
      ])
      return {
        strong: strongResult.status === 'fulfilled' ? strongResult.value : undefined,
        interlinear: interlinearResult.status === 'fulfilled' ? interlinearResult.value : [],
      }
    },
  })

  const strongAvailable = availability.strong?.status === 'available'
  const installedInterlinear = availability.interlinear.find(
    ({ availability: sidecarAvailability }) => sidecarAvailability.status === 'available'
  )
  const reverseInterlinearAvailable = strongAvailable && Boolean(installedInterlinear)
  const downloadStatesById = new Map(
    [
      bibleDownload,
      strongDownload,
      bhgDownload,
      frenchInterlinearDownload,
      englishInterlinearDownload,
    ].flatMap(state => (state ? [[state.item.id, state] as const] : []))
  )
  const getModeDownloadPresentation = (mode: Exclude<StrongMode, 'hidden'>) => {
    const confirmedIds = getConfirmedStrongModeDownloadIds({
      mode,
      version: version as StrongBibleVersionId,
      requestedIds: downloadPlanIds[mode],
      pendingVersion: bible.data.pendingStrongModeVersionId,
      pendingMode: bible.data.pendingStrongMode,
      pendingInterlinearLocale: bible.data.pendingStrongInterlinearLocale,
    })
    return getDownloadPlanPresentation(
      confirmedIds.flatMap(id => {
        const state = downloadStatesById.get(id)
        return state ? [state] : []
      })
    )
  }
  const strongDownloadPresentation = getModeDownloadPresentation('visible')
  const reverseInterlinearDownloadPresentation = getModeDownloadPresentation('reverse-interlinear')

  useEffect(() => {
    if (bible.data.pendingStrongModeVersionId === version && bible.data.pendingStrongMode) {
      setModeAwaitingSelection(bible.data.pendingStrongMode)
    }
  }, [bible.data.pendingStrongMode, bible.data.pendingStrongModeVersionId, version])

  useEffect(() => {
    if (!modeAwaitingSelection || selectedMode !== modeAwaitingSelection) return
    setModeAwaitingSelection(undefined)
    sheetRef.current?.dismiss()
  }, [modeAwaitingSelection, selectedMode, sheetRef])

  const selectMode = (mode: StrongMode) => {
    if (!isStrongCapableBibleVersion(version)) return
    if (
      mode === 'hidden' ||
      (mode === 'visible' && strongAvailable) ||
      (mode === 'reverse-interlinear' && reverseInterlinearAvailable)
    ) {
      actions.setStrongMode(mode)
      sheetRef.current?.dismiss()
    }
  }

  const requestDownload = (mode: Exclude<StrongMode, 'hidden'>) => {
    if (!isStrongCapableBibleVersion(version)) return
    try {
      const strong = availability.strong
      if (!strong) throw new Error('STRONG_AVAILABILITY_UNAVAILABLE')
      const interlinear = mode === 'reverse-interlinear' ? availability.interlinear : []
      if (mode === 'reverse-interlinear' && !interlinear.length) {
        throw new Error('INTERLINEAR_AVAILABILITY_UNAVAILABLE')
      }

      const versionId = version as StrongBibleVersionId
      const plan = createStrongModeDownloadPlan({
        mode,
        versionId,
        strongAvailability: strong,
        interlinearAvailabilities: interlinear,
      })
      if (!plan.items.length) {
        actions.setStrongMode(mode)
        sheetRef.current?.dismiss()
        return
      }

      const size = Math.max(1, Math.ceil(getDownloadPlanEstimatedSize(plan.items) / 1_000_000))
      const modeLabel = mode === 'visible' ? t('Strong') : t('Interlinéaire inversé')
      Alert.alert(
        t('Télécharger'),
        t(
          'Les ressources manquantes pour « {{mode}} » représentent environ {{size}} Mo. Voulez-vous les télécharger ?',
          { mode: modeLabel, size }
        ),
        [
          { text: t('Annuler'), style: 'cancel' },
          {
            text: t('Télécharger'),
            onPress: () => {
              setModeAwaitingSelection(mode)
              setDownloadPlanIds(current => ({
                ...current,
                [mode]: plan.items.map(item => item.id),
              }))
              actions.setPendingStrongModeVersion(
                versionId,
                mode,
                mode === 'reverse-interlinear' ? plan.preferredInterlinearLocale : undefined
              )
              downloadManager.enqueue(plan.items)
            },
          },
        ]
      )
    } catch {
      Alert.alert(
        t('Erreur'),
        t("Une erreur est survenue. Assurez-vous d'être connecté à Internet.")
      )
    }
  }

  const hasLoadedAvailability = Boolean(availability.strong)
  const strongDownloadRequired = hasLoadedAvailability && !strongAvailable
  const reverseInterlinearDownloadRequired = hasLoadedAvailability && !reverseInterlinearAvailable
  const strongDownloading =
    strongDownloadPresentation.status === 'active' ||
    (modeAwaitingSelection === 'visible' && strongDownloadPresentation.status !== 'failed')
  const reverseInterlinearDownloading =
    reverseInterlinearDownloadPresentation.status === 'active' ||
    (modeAwaitingSelection === 'reverse-interlinear' &&
      reverseInterlinearDownloadPresentation.status !== 'failed')

  const downloadLabel = (mode: string) => t('Télécharger les ressources pour {{mode}}', { mode })

  return (
    <Sheet ref={sheetRef} header={<SheetHeader title={t('Affichage du texte')} />}>
      <SheetView p={16} gap={10}>
        <BibleDisplayModeCard
          layout="list"
          label={t('Texte')}
          description={t('Traduction seule')}
          selected={selectedMode === 'hidden'}
          onPress={() => selectMode('hidden')}
        >
          <Text fontSize={16} lineHeight={21} textAlign="right">
            {translationPreview}
          </Text>
        </BibleDisplayModeCard>
        <BibleDisplayModeCard
          layout="list"
          label={t('Strong')}
          description={t('Texte + numéros')}
          selected={selectedMode === 'visible'}
          onPress={() => selectMode('visible')}
          downloadRequired={strongDownloadRequired}
          downloading={strongDownloading}
          downloadProgress={strongDownloadPresentation.progress}
          downloadAccessibilityLabel={downloadLabel(t('Strong'))}
          onDownloadPress={() => requestDownload('visible')}
        >
          <Box row center gap={4}>
            <Text fontSize={16}>{translationPreview}</Text>
            <Text fontSize={10} color="tertiary" style={{ fontFamily: serifFontFamily }}>
              {strongPreview}
            </Text>
          </Box>
        </BibleDisplayModeCard>
        <BibleDisplayModeCard
          layout="list"
          label={t('Interlinéaire inversé')}
          description={t('Traduction puis original')}
          selected={selectedMode === 'reverse-interlinear'}
          onPress={() => selectMode('reverse-interlinear')}
          downloadRequired={reverseInterlinearDownloadRequired}
          downloading={reverseInterlinearDownloading}
          downloadProgress={reverseInterlinearDownloadPresentation.progress}
          downloadAccessibilityLabel={downloadLabel(t('Interlinéaire inversé'))}
          onDownloadPress={() => requestDownload('reverse-interlinear')}
        >
          <Box alignItems="flex-end">
            <Text bold fontSize={14} lineHeight={18}>
              {translationPreview}
            </Text>
            <Text fontSize={16} lineHeight={20} style={{ fontFamily: serifFontFamily }}>
              {originalPreview}
            </Text>
            <Text fontSize={8} color="tertiary">
              {`${transliterationPreview} · ${morphologyPreview} · ${strongPreview}`}
            </Text>
          </Box>
        </BibleDisplayModeCard>
      </SheetView>
    </Sheet>
  )
}

export default StrongModeSelectorSheet
