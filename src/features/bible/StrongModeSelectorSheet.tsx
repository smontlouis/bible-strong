import { useAtomValue } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
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
  const [availability, setAvailability] = useState<AvailabilityState>({ interlinear: [] })
  const [downloadPlanIds, setDownloadPlanIds] = useState<
    Partial<Record<Exclude<StrongMode, 'hidden'>, string[]>>
  >({})
  const isHebrew = bible.data.selectedBook.Numero <= 39
  const originalPreview = isHebrew ? 'בְּרֵאשִׁית' : 'λόγος'
  const translationPreview = appLanguage === 'fr' ? 'commencement' : 'beginning'
  const transliterationPreview = isHebrew ? 'be.re.Shit' : 'logos'
  const morphologyPreview = isHebrew ? 'HNcfsa' : 'GNcmsn'
  const strongPreview = isHebrew ? 'H7225' : 'G3056'
  const serifFontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif'

  useEffect(() => {
    let cancelled = false
    setAvailability({ interlinear: [] })
    Promise.allSettled([
      readStrongAvailability(version),
      readInterlinearAvailabilities(version, appLanguage),
    ]).then(([strongResult, interlinearResult]) => {
      if (cancelled) return
      setAvailability({
        strong: strongResult.status === 'fulfilled' ? strongResult.value : undefined,
        interlinear: interlinearResult.status === 'fulfilled' ? interlinearResult.value : [],
      })
    })
    return () => {
      cancelled = true
    }
  }, [
    appLanguage,
    bhgDownload?.status,
    downloadCompletionSignal,
    englishInterlinearDownload?.status,
    frenchInterlinearDownload?.status,
    strongDownload?.status,
    version,
  ])

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

  const selectMode = (mode: StrongMode) => {
    if (!isStrongCapableBibleVersion(version)) return
    if (
      mode === 'hidden' ||
      (mode === 'visible' && strongAvailable) ||
      (mode === 'reverse-interlinear' && reverseInterlinearAvailable)
    ) {
      actions.setStrongMode(mode)
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

  const downloadLabel = (mode: string) => t('Télécharger les ressources pour {{mode}}', { mode })

  return (
    <Sheet ref={sheetRef} header={<SheetHeader title={t('Affichage du texte')} />}>
      <SheetView p={16} gap={10}>
        <Box row gap={10}>
          <BibleDisplayModeCard
            label={t('Texte')}
            description={t('Traduction seule')}
            selected={selectedMode === 'hidden'}
            onPress={() => selectMode('hidden')}
          >
            <Text fontSize={20} lineHeight={26} textAlign="center">
              {translationPreview}
            </Text>
          </BibleDisplayModeCard>
          <BibleDisplayModeCard
            label={t('Interlinéaire inversé')}
            description={t('Traduction puis original')}
            selected={selectedMode === 'reverse-interlinear'}
            onPress={() => selectMode('reverse-interlinear')}
            downloadRequired={reverseInterlinearDownloadRequired}
            downloading={reverseInterlinearDownloadPresentation.status === 'active'}
            downloadProgress={reverseInterlinearDownloadPresentation.progress}
            downloadAccessibilityLabel={downloadLabel(t('Interlinéaire inversé'))}
            onDownloadPress={() => requestDownload('reverse-interlinear')}
          >
            <Box alignSelf="center" alignItems="flex-start">
              <Text bold fontSize={16} lineHeight={21}>
                {translationPreview}
              </Text>
              <Text fontSize={19} lineHeight={24} style={{ fontFamily: serifFontFamily }}>
                {originalPreview}
              </Text>
              <Text fontSize={10} color="tertiary">
                {`${transliterationPreview} · ${morphologyPreview} · ${strongPreview}`}
              </Text>
            </Box>
          </BibleDisplayModeCard>
        </Box>
        <Box row>
          <BibleDisplayModeCard
            label={t('Strong')}
            description={t('Texte + numéros')}
            selected={selectedMode === 'visible'}
            onPress={() => selectMode('visible')}
            downloadRequired={strongDownloadRequired}
            downloading={strongDownloadPresentation.status === 'active'}
            downloadProgress={strongDownloadPresentation.progress}
            downloadAccessibilityLabel={downloadLabel(t('Strong'))}
            onDownloadPress={() => requestDownload('visible')}
          >
            <Box row center gap={7}>
              <Text fontSize={20}>{translationPreview}</Text>
              <Text fontSize={12} color="tertiary" style={{ fontFamily: serifFontFamily }}>
                {strongPreview}
              </Text>
            </Box>
          </BibleDisplayModeCard>
        </Box>
      </SheetView>
    </Sheet>
  )
}

export default StrongModeSelectorSheet
