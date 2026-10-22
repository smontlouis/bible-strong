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
import {
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
  type StrongMode,
} from '~helpers/strongBiblePublications'
import useLanguage from '~helpers/useLanguage'
import { useBibleTabActions, type BibleTab } from '~state/tabs'
import { getBibleColumnTextModes, type BibleTextModeColumn } from '~helpers/bibleColumnTextModes'
import BibleDisplayModeCard from './BibleDisplayModeCard'
import { useResourceAccess } from '~features/resources/resourceAccess'
import {
  loadStrongModeAvailability,
  type StrongModeAvailabilityState,
} from './loadStrongModeAvailability'
import { localQueryOptions } from '~helpers/queryOptions'
import {
  getOfflineResourceQuerySignal,
  useOfflineResourceRegistry,
} from '~features/resources/useOfflineResourceRegistry'
import OfflineCopiesLink from './OfflineCopiesLink'
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
  const resourceRegistry = useOfflineResourceRegistry()
  const columnModes = getBibleColumnTextModes(bible.data, column)
  const selectedMode = columnModes?.strongMode ?? 'hidden'
  const version = columnModes?.version ?? bible.data.selectedVersion
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

  const strongAvailable = availability.strong?.status === 'available'
  const installedInterlinear = availability.interlinear.find(
    ({ availability: sidecarAvailability }) => sidecarAvailability.status === 'available'
  )
  const reverseInterlinearAvailable = strongAvailable && Boolean(installedInterlinear)
  // Read online or from an Offline copy: a mode is only out of reach offline, without its copy
  const hasCheckedAvailability = !availabilityQuery.isPending
  const strongUnavailable = hasCheckedAvailability && !strongAvailable
  const reverseInterlinearUnavailable = hasCheckedAvailability && !reverseInterlinearAvailable

  const selectMode = (mode: StrongMode) => {
    if (!isStrongCapableBibleVersion(version)) return
    if (
      mode === 'hidden' ||
      (mode === 'visible' && strongAvailable) ||
      ((mode === 'transliteration' || mode === 'reverse-interlinear') &&
        reverseInterlinearAvailable)
    ) {
      actions.setStrongMode(mode, column)
      sheetRef?.current?.dismiss()
      onClose?.()
    }
  }

  useBibleKeyboardShortcut(
    'strongMode',
    bible.id,
    () => {
      selectMode(
        nextAvailableStrongMode(selectedMode, strongAvailable, reverseInterlinearAvailable)
      )
    },
    // The shortcut sets the main version's mode.
    { enabled: !inline && column === 0 && availabilityQuery.isSuccess }
  )

  const close = () => {
    sheetRef?.current?.dismiss()
    onClose?.()
  }

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
            unavailable={strongUnavailable}
            unavailableLabel={t('bibleDisplayMode.connectionRequired')}
            onPress={() => selectMode('visible')}
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
            unavailable={reverseInterlinearUnavailable}
            unavailableLabel={t('bibleDisplayMode.connectionRequired')}
            onPress={() => selectMode('transliteration')}
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
            unavailable={reverseInterlinearUnavailable}
            unavailableLabel={t('bibleDisplayMode.connectionRequired')}
            onPress={() => selectMode('reverse-interlinear')}
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
        {(strongUnavailable || reverseInterlinearUnavailable) && (
          <OfflineCopiesLink onPress={close} />
        )}
      </SheetView>
    </Container>
  )
}

export default StrongModeSelectorSheet
