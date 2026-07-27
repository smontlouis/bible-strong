import { useAtomValue } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useEffect, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Sheet, SheetHeader, type SheetRef } from '~common/sheet'
import { SheetView } from '~common/sheet-expo-ui'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Progress from '~common/ui/Progress'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { createInterlinearSidecarDownloadPlan } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import {
  normalizeInterlinearMode,
  type InterlinearDisplayMode,
} from '~helpers/interlinearBiblePublications'
import {
  getInterlinearSidecarAvailability,
  type InterlinearSidecarAvailability,
} from '~helpers/interlinearBibleSidecar'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import useLanguage from '~helpers/useLanguage'
import { downloadCompletionSignalAtom, getDownloadItemProgress } from '~state/downloadQueue'
import { useBibleTabActions, type BibleTab } from '~state/tabs'
import BibleDisplayModeCard from './BibleDisplayModeCard'

type Props = {
  bibleAtom: PrimitiveAtom<BibleTab>
  sheetRef: RefObject<SheetRef | null>
}

type AvailabilityByLocale = Partial<Record<ResourceLanguage, InterlinearSidecarAvailability>>
type DisplayMode = 'hidden' | InterlinearDisplayMode

const isActiveDownload = (status?: string) =>
  status === 'queued' || status === 'downloading' || status === 'inserting'

const InterlinearModeSelectorSheet = ({ bibleAtom, sheetRef }: Props) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const appLanguage = useLanguage()
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const frenchDownload = useDownloadItemStatus('bible-interlinear:BHG:fr')
  const englishDownload = useDownloadItemStatus('bible-interlinear:BHG:en')
  const [availability, setAvailability] = useState<AvailabilityByLocale>({})
  const selectedMode = normalizeInterlinearMode(bible.data.interlinearMode)
  const selectedLocale: ResourceLanguage = bible.data.interlinearLocale ?? appLanguage
  const isHebrew = bible.data.selectedBook.Numero <= 39
  const originalPreview = isHebrew ? 'אֱלֹהִים' : 'λόγος'
  const transliterationPreview = isHebrew ? 'Elohim bara' : 'logos en'
  const glossPreview = isHebrew ? 'Dieu · H0430' : 'Parole · G3056'
  const serifFontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif'

  useEffect(() => {
    let cancelled = false
    Promise.all([getInterlinearSidecarAvailability('fr'), getInterlinearSidecarAvailability('en')])
      .then(([fr, en]) => {
        if (!cancelled) setAvailability({ fr, en })
      })
      .catch(() => {
        if (!cancelled) setAvailability({})
      })
    return () => {
      cancelled = true
    }
  }, [downloadCompletionSignal, englishDownload?.status, frenchDownload?.status])

  const getDownload = (locale: ResourceLanguage) =>
    locale === 'fr' ? frenchDownload : englishDownload

  const isAvailable = (locale: ResourceLanguage) => availability[locale]?.status === 'available'

  const ensureAvailability = async (): Promise<AvailabilityByLocale> => {
    if (availability.fr && availability.en) return availability

    const [fr, en] = await Promise.all([
      availability.fr ?? getInterlinearSidecarAvailability('fr').catch(() => undefined),
      availability.en ?? getInterlinearSidecarAvailability('en').catch(() => undefined),
    ])
    const resolved = { fr, en }
    setAvailability(resolved)
    return resolved
  }

  const downloadLocale = async (
    locale: ResourceLanguage,
    modeAfterDownload?: InterlinearDisplayMode
  ) => {
    const resolvedAvailability =
      availability[locale] ??
      (await getInterlinearSidecarAvailability(locale).catch(() => undefined))
    if (!resolvedAvailability) return
    setAvailability(current => ({ ...current, [locale]: resolvedAvailability }))
    if (resolvedAvailability.status === 'available') {
      if (modeAfterDownload) {
        actions.setInterlinearMode(modeAfterDownload, selectedLocale)
      }
      return
    }

    if (modeAfterDownload) {
      actions.setPendingInterlinearDownload(true, modeAfterDownload, selectedLocale)
    }
    downloadManager.enqueue(
      createInterlinearSidecarDownloadPlan(locale, resolvedAvailability.status)
    )
  }

  const selectMode = async (mode: DisplayMode) => {
    if (mode === 'hidden') {
      actions.setInterlinearMode('hidden', selectedLocale)
      return
    }

    const preferredLocale = selectedLocale
    const fallbackLocale = preferredLocale === 'fr' ? 'en' : 'fr'
    const resolvedAvailability = await ensureAvailability()
    const mayFallback = mode !== 'interlinear'
    if (
      resolvedAvailability[preferredLocale]?.status === 'available' ||
      (mayFallback && resolvedAvailability[fallbackLocale]?.status === 'available')
    ) {
      actions.setInterlinearMode(mode, selectedLocale)
      return
    }

    await downloadLocale(preferredLocale, mode)
  }

  const selectLocale = (locale: ResourceLanguage) => {
    if (!isAvailable(locale)) return
    actions.setInterlinearMode(bible.data.interlinearMode ?? 'hidden', locale)
  }

  const renderLocaleOption = (locale: ResourceLanguage, label: string) => {
    const selected = selectedLocale === locale
    const available = isAvailable(locale)
    const localeDownload = getDownload(locale)
    const downloading = isActiveDownload(localeDownload?.status)

    return (
      <Pressable
        accessibilityRole={available ? 'button' : undefined}
        accessibilityState={{ selected, disabled: !available || downloading }}
        accessibilityLabel={
          available
            ? label
            : t('Télécharger l’index interlinéaire {{language}}', { language: label })
        }
        disabled={downloading}
        onPress={() => (available ? selectLocale(locale) : downloadLocale(locale))}
        style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.72 : 1 })}
      >
        <Box
          flex
          row
          center
          gap={7}
          bg={selected && available ? 'primary' : undefined}
          opacity={available || downloading ? 1 : 0.65}
        >
          <Text bold fontSize={14} color={selected && available ? 'reverse' : 'default'}>
            {label}
          </Text>
          {!available &&
            (downloading && localeDownload ? (
              <Progress
                progress={Math.max(getDownloadItemProgress(localeDownload), 0.04)}
                size={18}
                thickness={2.2}
              />
            ) : (
              <FeatherIcon name="download-cloud" size={18} color="default" />
            ))}
        </Box>
      </Pressable>
    )
  }

  return (
    <Sheet ref={sheetRef} header={<SheetHeader title={t('Affichage du texte')} />}>
      <SheetView p={16} gap={10}>
        <Box row gap={10}>
          <BibleDisplayModeCard
            label={t('Original')}
            description={t('Hébreu ou grec')}
            selected={selectedMode === 'hidden'}
            onPress={() => selectMode('hidden')}
          >
            <Text
              fontSize={29}
              lineHeight={38}
              textAlign="center"
              style={{ fontFamily: serifFontFamily }}
            >
              {originalPreview}
            </Text>
          </BibleDisplayModeCard>
          <BibleDisplayModeCard
            label={t('Interlinéaire')}
            description={t('Mot par mot')}
            selected={selectedMode === 'interlinear'}
            onPress={() => selectMode('interlinear')}
          >
            <Box alignSelf="center" alignItems={isHebrew ? 'flex-end' : 'flex-start'}>
              <Text fontSize={25} lineHeight={30} style={{ fontFamily: serifFontFamily }}>
                {originalPreview}
              </Text>
              <Text fontSize={14} lineHeight={19} style={{ fontFamily: serifFontFamily }}>
                {isHebrew ? 'Elohim' : 'logos'}
              </Text>
              <Text fontSize={11} color="tertiary">
                {glossPreview}
              </Text>
            </Box>
          </BibleDisplayModeCard>
        </Box>

        <Box row gap={10}>
          <BibleDisplayModeCard
            label={t('Strong')}
            description={t('Texte + numéros')}
            selected={selectedMode === 'strong'}
            onPress={() => selectMode('strong')}
          >
            <Box row center gap={7}>
              <Text fontSize={25} style={{ fontFamily: serifFontFamily }}>
                {originalPreview}
              </Text>
              <Text fontSize={12} color="tertiary" style={{ fontFamily: serifFontFamily }}>
                {isHebrew ? 'H0430' : 'G3056'}
              </Text>
            </Box>
          </BibleDisplayModeCard>
          <BibleDisplayModeCard
            label={t('Translittération')}
            description={t('Caractères latins')}
            selected={selectedMode === 'transliteration'}
            onPress={() => selectMode('transliteration')}
          >
            <Text
              fontSize={20}
              lineHeight={26}
              textAlign="center"
              style={{ fontFamily: serifFontFamily }}
            >
              {transliterationPreview}
            </Text>
          </BibleDisplayModeCard>
        </Box>

        {selectedMode === 'interlinear' && (
          <Box
            bg="reverse"
            bgOpacity="020"
            row
            alignItems="center"
            gap={12}
            borderWidth={1}
            borderColor="border"
            borderRadius={16}
            p={12}
          >
            <Text flex bold fontSize={14}>
              {t('Langue des gloses')}
            </Text>
            <Box row width={132} height={38} borderWidth={1} borderColor="border" borderRadius={10}>
              {renderLocaleOption('fr', 'FR')}
              <Box width={1} bg="border" />
              {renderLocaleOption('en', 'EN')}
            </Box>
          </Box>
        )}
      </SheetView>
    </Sheet>
  )
}

export default InterlinearModeSelectorSheet
