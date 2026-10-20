import InlineDisplayModeContent from './InlineDisplayModeContent'
import { twMerge } from '~common/ui/classNames'
import { resolveThemeColor, colorWithOpacity } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { useAtomValue } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useQuery } from '@tanstack/react-query'
import { type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, Pressable } from 'react-native'
import { SheetHeader, SheetView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import {
  normalizeInterlinearMode,
  type InterlinearDisplayMode,
} from '~helpers/interlinearBiblePublications'
import type { InterlinearSidecarAvailability } from '~helpers/interlinearBibleSidecar'
import useLanguage from '~helpers/useLanguage'
import { useBibleTabActions, type BibleTab } from '~state/tabs'
import BibleDisplayModeCard from './BibleDisplayModeCard'
import OfflineCopiesLink from './OfflineCopiesLink'
import { useResourceAccess } from '~features/resources/resourceAccess'
import {
  loadInterlinearModeAvailability,
  type InterlinearModeAvailabilityState,
} from './loadInterlinearModeAvailability'
import { localQueryOptions } from '~helpers/queryOptions'
import { getBibleColumnTextModes, type BibleTextModeColumn } from '~helpers/bibleColumnTextModes'
import {
  getOfflineResourceQuerySignal,
  useOfflineResourceRegistry,
} from '~features/resources/useOfflineResourceRegistry'
type Props = {
  bibleAtom: PrimitiveAtom<BibleTab>
  sheetRef?: RefObject<SheetRef | null>
  inline?: boolean
  onClose?: () => void
  /** The column whose mode the sheet sets: 0 is the main version, n the n-th parallel one. */
  column?: BibleTextModeColumn
}

type AvailabilityByLocale = Partial<Record<ResourceLanguage, InterlinearSidecarAvailability>>
type DisplayMode = 'hidden' | InterlinearDisplayMode

const InterlinearModeSelectorSheet = ({
  bibleAtom,
  sheetRef,
  inline = false,
  onClose,
  column = 0,
}: Props) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const appLanguage = useLanguage()
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const resources = useResourceAccess()
  const resourceRegistry = useOfflineResourceRegistry()
  const columnModes = getBibleColumnTextModes(bible.data, column)
  const selectedMode = normalizeInterlinearMode(columnModes?.interlinearMode)
  const selectedLocale: ResourceLanguage = columnModes?.interlinearLocale ?? appLanguage
  const isHebrew = bible.data.selectedBook.Numero <= 39
  const originalPreview = isHebrew ? 'אֱלֹהִים' : 'λόγος'
  const transliterationPreview = isHebrew ? 'Elohim bara' : 'logos en'
  const glossPreview = isHebrew ? 'Dieu · H0430' : 'Parole · G3056'
  const serifFontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif'

  const availabilityQuery = useQuery<InterlinearModeAvailabilityState>({
    queryKey: [
      'interlinear-mode-availability',
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
      loadInterlinearModeAvailability(resources.lexiconBible.getInterlinearAvailability),
    ...localQueryOptions,
  })
  const availability: AvailabilityByLocale = availabilityQuery.data ?? {}

  const isAvailable = (locale: ResourceLanguage) => availability[locale]?.status === 'available'

  const selectMode = async (mode: DisplayMode) => {
    if (mode === 'hidden') {
      actions.setInterlinearMode('hidden', selectedLocale, column)
      sheetRef?.current?.dismiss()
      onClose?.()
      return
    }

    const preferredLocale = selectedLocale
    const fallbackLocale = preferredLocale === 'fr' ? 'en' : 'fr'
    const resolvedAvailability = availabilityQuery.data ?? (await availabilityQuery.refetch()).data
    if (!resolvedAvailability) return
    const mayFallback = mode !== 'interlinear'
    if (
      resolvedAvailability[preferredLocale]?.status === 'available' ||
      (mayFallback && resolvedAvailability[fallbackLocale]?.status === 'available')
    ) {
      actions.setInterlinearMode(mode, selectedLocale, column)
      sheetRef?.current?.dismiss()
      onClose?.()
    }
  }

  const selectLocale = (locale: ResourceLanguage) => {
    if (!isAvailable(locale)) return
    actions.setInterlinearMode(columnModes?.interlinearMode ?? 'hidden', locale, column)
  }

  const renderLocaleOption = (locale: ResourceLanguage, label: string) => {
    const selected = selectedLocale === locale
    const available = isAvailable(locale)

    if (Platform.OS === 'web' && !available) return null

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected, disabled: !available }}
        accessibilityLabel={
          available ? label : `${label}. ${t('bibleDisplayMode.connectionRequired')}`
        }
        disabled={!available}
        onPress={() => selectLocale(locale)}
        style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.72 : 1 })}
      >
        <Box
          className={twMerge(
            'overflow-hidden border-continuous',
            twMerge(
              selected && available ? 'bg-primary' : '',
              'overflow-hidden border-continuous flex-[1] flex-row items-center justify-center gap-[7px] rounded-full'
            )
          )}
          style={{ opacity: available ? 1 : 0.65 }}
        >
          <Text
            className={twMerge(
              selected && available ? 'text-reverse' : 'text-default',
              'font-bold text-[14px]'
            )}
          >
            {label}
          </Text>
          {!available && <FeatherIcon name="wifi-off" size={16} color="grey" />}
        </Box>
      </Pressable>
    )
  }

  const preferredAvailable = isAvailable(selectedLocale)
  const fallbackLocale: ResourceLanguage = selectedLocale === 'fr' ? 'en' : 'fr'
  const fallbackAvailable = isAvailable(fallbackLocale)
  // Read online or from an Offline copy: a mode is only out of reach offline, without its copy
  const hasCheckedAvailability = !availabilityQuery.isPending
  const interlinearUnavailable = hasCheckedAvailability && !preferredAvailable
  // Strong and transliteration may fall back on the other gloss language
  const fallbackCapableUnavailable =
    hasCheckedAvailability && !preferredAvailable && !fallbackAvailable
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
            label={t('Original')}
            description={t('Hébreu ou grec')}
            selected={selectedMode === 'hidden'}
            onPress={() => selectMode('hidden')}
          >
            <Text
              className="text-[29px] leading-[38px] text-center"
              style={{ fontFamily: serifFontFamily }}
            >
              {originalPreview}
            </Text>
          </BibleDisplayModeCard>
          <BibleDisplayModeCard
            label={t('Interlinéaire')}
            description={t('Mot par mot')}
            selected={selectedMode === 'interlinear'}
            unavailable={interlinearUnavailable}
            unavailableLabel={t('bibleDisplayMode.connectionRequired')}
            onPress={() => selectMode('interlinear')}
          >
            <Box
              className="overflow-hidden border-continuous self-center"
              style={{ alignItems: isHebrew ? 'flex-end' : 'flex-start' }}
            >
              <Text className="text-[25px] leading-[30px]" style={{ fontFamily: serifFontFamily }}>
                {originalPreview}
              </Text>
              <Text className="text-[14px] leading-[19px]" style={{ fontFamily: serifFontFamily }}>
                {isHebrew ? 'Elohim' : 'logos'}
              </Text>
              <Text className="text-[11px] text-tertiary">{glossPreview}</Text>
            </Box>
          </BibleDisplayModeCard>
        </Box>

        <Box className="overflow-hidden border-continuous flex-row gap-[10px]">
          <BibleDisplayModeCard
            label={t('Strong')}
            description={t('Texte + numéros')}
            selected={selectedMode === 'strong'}
            unavailable={fallbackCapableUnavailable}
            unavailableLabel={t('bibleDisplayMode.connectionRequired')}
            onPress={() => selectMode('strong')}
          >
            <Box className="overflow-hidden border-continuous flex-row items-center justify-center gap-[7px]">
              <Text className="text-[25px]" style={{ fontFamily: serifFontFamily }}>
                {originalPreview}
              </Text>
              <Text className="text-[12px] text-tertiary" style={{ fontFamily: serifFontFamily }}>
                {isHebrew ? 'H0430' : 'G3056'}
              </Text>
            </Box>
          </BibleDisplayModeCard>
          <BibleDisplayModeCard
            label={t('Translittération')}
            description={t('Caractères latins')}
            selected={selectedMode === 'transliteration'}
            unavailable={fallbackCapableUnavailable}
            unavailableLabel={t('bibleDisplayMode.connectionRequired')}
            onPress={() => selectMode('transliteration')}
          >
            <Text
              className="text-[20px] leading-[26px] text-center"
              style={{ fontFamily: serifFontFamily }}
            >
              {transliterationPreview}
            </Text>
          </BibleDisplayModeCard>
        </Box>

        {selectedMode === 'interlinear' && (
          // An inner panel on the translucent well of the cards, with a pill segmented control
          <Box
            className="border-continuous overflow-hidden flex-row items-center gap-[12px] rounded-[12px] p-[12px]"
            style={{
              backgroundColor: colorWithOpacity(resolveThemeColor(stylingTheme, 'lightGrey'), 0.5),
            }}
          >
            <Text className="flex-[1] font-bold text-[14px]">{t('Langue des gloses')}</Text>
            <Box
              className="border-continuous overflow-hidden flex-row w-[132px] h-[38px] p-[3px] gap-[2px] rounded-full"
              style={{
                backgroundColor: colorWithOpacity(resolveThemeColor(stylingTheme, 'default'), 0.07),
              }}
            >
              {renderLocaleOption('fr', 'FR')}
              {renderLocaleOption('en', 'EN')}
            </Box>
          </Box>
        )}
        {(interlinearUnavailable || fallbackCapableUnavailable) && (
          <OfflineCopiesLink onPress={close} />
        )}
      </SheetView>
    </Container>
  )
}

export default InterlinearModeSelectorSheet
