import { useBibleKeyboardShortcut } from './useBibleKeyboardShortcut'
import { nextAvailableStrongMode } from './bibleKeyboardActions'
import InlineDisplayModeContent from './InlineDisplayModeContent'
import { useAtomValue } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useQuery } from '@tanstack/react-query'
import { type RefObject } from 'react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SheetHeader, SheetView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { downloadManager } from '~helpers/downloadManager'
import { createStrongLexiconModuleDownloadItem } from '~helpers/downloadItemFactory'
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
import { getBibleColumnTextModes, type BibleTextModeColumn } from '~helpers/bibleColumnTextModes'
import BibleDisplayModeCard from './BibleDisplayModeCard'
import { toast } from '~helpers/toast'
import { useResourceAccess } from '~features/resources/resourceAccess'
import useConnection from '~helpers/useConnection'
import {
  loadStrongModeAvailability,
  type StrongModeAvailabilityState,
} from './loadStrongModeAvailability'
import { localQueryOptions } from '~helpers/queryOptions'
import {
  getOfflineResourceQuerySignal,
  useOfflineResourceRegistry,
} from '~features/resources/useOfflineResourceRegistry'
import { useStrongIndexLexiconModuleId } from '~features/resources/useStrongIndexLexicon'
type Props = {
  bibleAtom: PrimitiveAtom<BibleTab>
  sheetRef?: RefObject<SheetRef | null>
  inline?: boolean
  onClose?: () => void
  /** The column whose mode the sheet sets: 0 is the main version, n the n-th parallel one. */
  column?: BibleTextModeColumn
}

const StrongModeSelectorSheet = ({
  bibleAtom,
  sheetRef,
  inline = false,
  onClose,
  column = 0,
}: Props) => {
  const { t } = useTranslation()
  const appLanguage = useLanguage()
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const resourceRegistry = useOfflineResourceRegistry()
  const lexiconModuleId = useStrongIndexLexiconModuleId()
  const downloadStates = useAtomValue(downloadItemStatesAtom)
  const columnModes = getBibleColumnTextModes(bible.data, column)
  const selectedMode = columnModes?.strongMode ?? 'hidden'
  const version = columnModes?.version ?? bible.data.selectedVersion
  const pendingAcquisition =
    bible.data.pendingModeAcquisition?.kind === 'strong' &&
    bible.data.pendingModeAcquisition.versionId === version &&
    (bible.data.pendingModeAcquisition.column ?? 0) === column
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
    queryKey: [
      'strong-mode-availability',
      version,
      appLanguage,
      getOfflineResourceQuerySignal(resourceRegistry, {
        kind: 'strong-bible-index',
        versionId: version as StrongBibleVersionId,
      }),
      getOfflineResourceQuerySignal(resourceRegistry, {
        kind: 'interlinear-index',
        versionId: 'BHG',
        language: 'fr',
      }),
      getOfflineResourceQuerySignal(resourceRegistry, {
        kind: 'interlinear-index',
        versionId: 'BHG',
        language: 'en',
      }),
    ],
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

  const getModeDownloadPresentation = (mode: Exclude<StrongMode, 'hidden'>) => {
    return getBibleModeAcquisitionPresentation(
      pendingAcquisition?.mode === mode ? pendingAcquisition : undefined,
      downloadStates
    )
  }
  const strongDownloadPresentation = getModeDownloadPresentation('visible')
  const transliterationDownloadPresentation = getModeDownloadPresentation('transliteration')
  const reverseInterlinearDownloadPresentation = getModeDownloadPresentation('reverse-interlinear')

  const selectMode = (mode: StrongMode) => {
    if (!isStrongCapableBibleVersion(version)) return
    if (
      mode === 'hidden' ||
      (mode === 'visible' && strongAvailable) ||
      ((mode === 'transliteration' || mode === 'reverse-interlinear') &&
        reverseInterlinearAvailable)
    ) {
      if (bible.data.pendingModeAcquisition) {
        actions.finishBibleModeAcquisition(false)
      }
      actions.setStrongMode(mode, column)
      sheetRef?.current?.dismiss()
      onClose?.()
    }
  }

  useBibleKeyboardShortcut(
    's',
    bible.id,
    () => {
      selectMode(
        nextAvailableStrongMode(selectedMode, strongAvailable, reverseInterlinearAvailable)
      )
    },
    // The shortcut sets the main version's mode.
    !inline && column === 0 && availabilityQuery.isSuccess
  )

  const requestDownload = (mode: Exclude<StrongMode, 'hidden'>) => {
    if (Platform.OS === 'web') return
    if (!isConnected || availabilityFailed) return
    if (!isStrongCapableBibleVersion(version)) return
    try {
      const strong = availability.strong
      if (!strong) throw new Error('STRONG_AVAILABILITY_UNAVAILABLE')
      // Every mode but Strong numbers reads the original words of the interlinear.
      const needsInterlinear = mode !== 'visible'
      const interlinear = needsInterlinear ? availability.interlinear : []
      if (needsInterlinear && !interlinear.length) {
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
        actions.setStrongMode(mode, column)
        sheetRef?.current?.dismiss()
        onClose?.()
        return
      }

      actions.startBibleModeAcquisition({
        kind: 'strong',
        column,
        versionId,
        mode,
        interlinearLocale: needsInterlinear ? plan.preferredInterlinearLocale : undefined,
        planIds: plan.items.map(item => item.id),
      })
      // The lexicon comes with a Strong index, without holding back the display mode.
      downloadManager.enqueue([
        ...plan.items,
        ...(lexiconModuleId && strong.status !== 'available'
          ? [createStrongLexiconModuleDownloadItem(lexiconModuleId)]
          : []),
      ])
    } catch {
      toast.error(t('resource.action.temporarilyUnavailable'))
    }
  }

  const hasLoadedAvailability = availabilityQuery.isSuccess && Boolean(availability.strong)
  const strongDownloadRequired = Platform.OS !== 'web' && hasLoadedAvailability && !strongAvailable
  const reverseInterlinearDownloadRequired =
    Platform.OS !== 'web' && hasLoadedAvailability && !reverseInterlinearAvailable
  const strongDownloading =
    pendingAcquisition?.mode === 'visible' && strongDownloadPresentation.status !== 'failed'
  const transliterationDownloading =
    pendingAcquisition?.mode === 'transliteration' &&
    transliterationDownloadPresentation.status !== 'failed'
  const reverseInterlinearDownloading =
    pendingAcquisition?.mode === 'reverse-interlinear' &&
    reverseInterlinearDownloadPresentation.status !== 'failed'

  const downloadLabel = (mode: string) =>
    isConnected
      ? t('Télécharger les ressources pour {{mode}}', { mode })
      : t('resource.action.connectionRequired')

  const Container = inline ? InlineDisplayModeContent : Sheet
  return (
    <Container ref={sheetRef} header={<SheetHeader title={t('Affichage du texte')} />}>
      <SheetView className="p-[16px] gap-[10px]">
        <Box className="overflow-hidden border-continuous flex-row gap-[10px]">
          <BibleDisplayModeCard
            label={t('Texte')}
            description={t('Traduction seule')}
            selected={selectedMode === 'hidden'}
            onPress={() => selectMode('hidden')}
          >
            <Text className="text-[25px] leading-[32px] text-center">{translationPreview}</Text>
          </BibleDisplayModeCard>
          <BibleDisplayModeCard
            label={t('Strong')}
            description={t('Texte + numéros')}
            selected={selectedMode === 'visible'}
            disabled={Platform.OS === 'web' && !strongAvailable}
            onPress={() => selectMode('visible')}
            downloadRequired={strongDownloadRequired}
            downloadDisabled={!isConnected || availabilityFailed}
            downloading={strongDownloading}
            downloadProgress={strongDownloadPresentation.progress}
            downloadAccessibilityLabel={downloadLabel(t('Strong'))}
            onDownloadPress={() => requestDownload('visible')}
          >
            <Box className="overflow-hidden border-continuous flex-row items-center justify-center gap-[7px]">
              <Text className="text-[25px]">{translationPreview}</Text>
              <Text className="text-[12px] text-tertiary" style={{ fontFamily: serifFontFamily }}>
                {strongPreview}
              </Text>
            </Box>
          </BibleDisplayModeCard>
        </Box>

        <Box className="overflow-hidden border-continuous flex-row gap-[10px]">
          <BibleDisplayModeCard
            label={t('Translittération')}
            description={t('Texte + mots originaux')}
            selected={selectedMode === 'transliteration'}
            disabled={Platform.OS === 'web' && !reverseInterlinearAvailable}
            onPress={() => selectMode('transliteration')}
            downloadRequired={reverseInterlinearDownloadRequired}
            downloadDisabled={!isConnected || availabilityFailed}
            downloading={transliterationDownloading}
            downloadProgress={transliterationDownloadPresentation.progress}
            downloadAccessibilityLabel={downloadLabel(t('Translittération'))}
            onDownloadPress={() => requestDownload('transliteration')}
          >
            <Box className="overflow-hidden border-continuous flex-row items-center justify-center gap-[7px]">
              <Text className="text-[25px]">{translationPreview}</Text>
              <Text
                className="text-[14px] text-tertiary italic"
                style={{ fontFamily: serifFontFamily }}
              >
                {transliterationPreview}
              </Text>
            </Box>
          </BibleDisplayModeCard>
          <BibleDisplayModeCard
            label={t('Interlinéaire inversé')}
            description={t('Traduction puis original')}
            selected={selectedMode === 'reverse-interlinear'}
            disabled={Platform.OS === 'web' && !reverseInterlinearAvailable}
            onPress={() => selectMode('reverse-interlinear')}
            downloadRequired={reverseInterlinearDownloadRequired}
            downloadDisabled={!isConnected || availabilityFailed}
            downloading={reverseInterlinearDownloading}
            downloadProgress={reverseInterlinearDownloadPresentation.progress}
            downloadAccessibilityLabel={downloadLabel(t('Interlinéaire inversé'))}
            onDownloadPress={() => requestDownload('reverse-interlinear')}
          >
            <Box className="overflow-hidden border-continuous items-center self-center">
              <Text className="font-bold text-[16px] leading-[21px]">{translationPreview}</Text>
              <Text className="text-[22px] leading-[28px]" style={{ fontFamily: serifFontFamily }}>
                {originalPreview}
              </Text>
              <Text className="text-[10px] text-tertiary">
                {`${transliterationPreview} · ${morphologyPreview} · ${strongPreview}`}
              </Text>
            </Box>
          </BibleDisplayModeCard>
        </Box>
      </SheetView>
    </Container>
  )
}

export default StrongModeSelectorSheet
