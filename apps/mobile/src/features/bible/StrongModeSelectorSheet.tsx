import { useAtomValue } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useQuery } from '@tanstack/react-query'
import { type RefObject, useEffect } from 'react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'

import { Sheet, SheetHeader, type SheetRef } from '~common/sheet'
import { SheetView } from '~common/sheet-expo-ui'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { downloadManager } from '~helpers/downloadManager'
import { createStrongModeDownloadPlan } from '~helpers/strongModeDownloadPlan'
import {
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
  type StrongMode,
} from '~helpers/strongBiblePublications'
import useLanguage from '~helpers/useLanguage'
import { downloadItemStatesAtom } from '~state/downloadQueue'
import { useBibleTabActions, type BibleTab } from '~state/tabs'
import { getBibleModeAcquisitionPresentation } from '~helpers/bibleModeAcquisition'

import BibleDisplayModeCard from './BibleDisplayModeCard'
import { toast } from '~helpers/toast'
import { useResourceAccess } from '~features/resources/resourceAccess'
import useConnection from '~helpers/useConnection'
import {
  loadStrongModeAvailability,
  type StrongModeAvailabilityState,
} from './loadStrongModeAvailability'
import { localQueryOptions } from '~helpers/queryOptions'
import { useOfflineResourceRegistry } from '~features/resources/useOfflineResourceRegistry'

type Props = {
  bibleAtom: PrimitiveAtom<BibleTab>
  sheetRef: RefObject<SheetRef | null>
}

const StrongModeSelectorSheet = ({ bibleAtom, sheetRef }: Props) => {
  const { t } = useTranslation()
  const appLanguage = useLanguage()
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const resourceRegistry = useOfflineResourceRegistry()
  const downloadStates = useAtomValue(downloadItemStatesAtom)
  const selectedMode = bible.data.strongMode ?? 'hidden'
  const version = bible.data.selectedVersion
  const pendingAcquisition =
    bible.data.pendingModeAcquisition?.kind === 'strong' &&
    bible.data.pendingModeAcquisition.versionId === version
      ? bible.data.pendingModeAcquisition
      : undefined
  const isHebrew = bible.data.selectedBook.Numero <= 39
  const originalPreview = isHebrew ? 'אֱלֹהִים' : 'θεός'
  const translationPreview = appLanguage === 'fr' ? 'Dieu' : 'God'
  const transliterationPreview = isHebrew ? 'Elohim' : 'theos'
  const morphologyPreview = isHebrew ? 'HNcmpa' : 'GNcmsn'
  const strongPreview = isHebrew ? 'H0430' : 'G2316'
  const serifFontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif'
  const availabilityQuery = useQuery<StrongModeAvailabilityState>({
    queryKey: ['strong-mode-availability', version, appLanguage, resourceRegistry.revision],
    queryFn: () =>
      loadStrongModeAvailability({
        appLanguage,
        getInterlinearAvailability: resources.lexiconBible.getInterlinearAvailability,
        getStrongAvailability: resources.strongBible.getAvailability,
        version,
      }),
    ...localQueryOptions,
  })
  const availability = availabilityQuery.data ?? { interlinear: [] }
  const availabilityFailed = availabilityQuery.isError

  const strongAvailable = availability.strong?.status === 'available'
  const installedInterlinear = availability.interlinear.find(
    ({ availability: sidecarAvailability }) => sidecarAvailability.status === 'available'
  )
  const reverseInterlinearAvailable = strongAvailable && Boolean(installedInterlinear)

  useEffect(() => {
    if (!availabilityQuery.isSuccess || !availability.strong || selectedMode === 'hidden') return
    const selectedModeAvailable =
      selectedMode === 'visible' ? strongAvailable : reverseInterlinearAvailable
    if (selectedModeAvailable) return
    actions.setStrongMode('hidden')
  }, [
    actions,
    availability.strong,
    availabilityQuery.isSuccess,
    reverseInterlinearAvailable,
    selectedMode,
    strongAvailable,
  ])
  const getModeDownloadPresentation = (mode: Exclude<StrongMode, 'hidden'>) => {
    return getBibleModeAcquisitionPresentation(
      pendingAcquisition?.mode === mode ? pendingAcquisition : undefined,
      downloadStates
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
      if (bible.data.pendingModeAcquisition) {
        actions.finishBibleModeAcquisition(false)
      }
      actions.setStrongMode(mode)
      sheetRef.current?.dismiss()
    }
  }

  const requestDownload = (mode: Exclude<StrongMode, 'hidden'>) => {
    if (!isConnected || availabilityFailed) return
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

      actions.startBibleModeAcquisition({
        kind: 'strong',
        versionId,
        mode,
        interlinearLocale:
          mode === 'reverse-interlinear' ? plan.preferredInterlinearLocale : undefined,
        planIds: plan.items.map(item => item.id),
      })
      downloadManager.enqueue(plan.items)
    } catch {
      toast.error(t('resource.action.temporarilyUnavailable'))
    }
  }

  const hasLoadedAvailability = availabilityQuery.isSuccess && Boolean(availability.strong)
  const strongDownloadRequired = hasLoadedAvailability && !strongAvailable
  const reverseInterlinearDownloadRequired = hasLoadedAvailability && !reverseInterlinearAvailable
  const strongDownloading =
    pendingAcquisition?.mode === 'visible' && strongDownloadPresentation.status !== 'failed'
  const reverseInterlinearDownloading =
    pendingAcquisition?.mode === 'reverse-interlinear' &&
    reverseInterlinearDownloadPresentation.status !== 'failed'

  const downloadLabel = (mode: string) =>
    isConnected
      ? t('Télécharger les ressources pour {{mode}}', { mode })
      : t('resource.action.connectionRequired')

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
          downloadDisabled={!isConnected || availabilityFailed}
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
          downloadDisabled={!isConnected || availabilityFailed}
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
