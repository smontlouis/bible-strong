import { useAtomValue } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useQuery } from '@tanstack/react-query'
import { type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform, Pressable } from 'react-native'

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
  const appLanguage = useLanguage()
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const frenchDownload = useDownloadItemStatus('bible-interlinear:BHG:fr')
  const englishDownload = useDownloadItemStatus('bible-interlinear:BHG:en')
  const selectedMode = normalizeInterlinearMode(bible.data.interlinearMode)
  const selectedLocale: ResourceLanguage = bible.data.interlinearLocale ?? appLanguage
  const isHebrew = bible.data.selectedBook.Numero <= 39
  const originalPreview = isHebrew ? 'אֱלֹהִים' : 'λόγος'
  const transliterationPreview = isHebrew ? 'Elohim bara' : 'logos en'
  const glossPreview = isHebrew ? 'Dieu · H0430' : 'Parole · G3056'
  const serifFontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif'

  const availabilityQuery = useQuery<AvailabilityByLocale>({
    queryKey: [
      'interlinear-mode-availability',
      downloadCompletionSignal,
      englishDownload?.status,
      frenchDownload?.status,
    ],
    queryFn: async () => {
      const [fr, en] = await Promise.all([
        getInterlinearSidecarAvailability('fr'),
        getInterlinearSidecarAvailability('en'),
      ])
      return { fr, en }
    },
  })
  const availability = availabilityQuery.data ?? {}

  const getDownload = (locale: ResourceLanguage) =>
    locale === 'fr' ? frenchDownload : englishDownload

  const isAvailable = (locale: ResourceLanguage) => availability[locale]?.status === 'available'

  const ensureAvailability = async (): Promise<AvailabilityByLocale> => {
    if (availability.fr && availability.en) return availability

    const result = await availabilityQuery.refetch()
    return result.data ?? {}
  }

  const requestDownload = async (
    locale: ResourceLanguage,
    modeLabel: string,
    modeAfterDownload?: InterlinearDisplayMode,
    knownAvailability?: InterlinearSidecarAvailability
  ) => {
    const resolvedAvailability =
      knownAvailability ??
      availability[locale] ??
      (await getInterlinearSidecarAvailability(locale).catch(() => undefined))
    if (!resolvedAvailability) return
    if (resolvedAvailability.status === 'available') {
      if (modeAfterDownload) {
        actions.setInterlinearMode(modeAfterDownload, selectedLocale)
      }
      return
    }

    const plan = createInterlinearSidecarDownloadPlan(locale, resolvedAvailability.status)
    const size = Math.max(
      1,
      Math.ceil(plan.reduce((total, item) => total + item.estimatedSize, 0) / 1_000_000)
    )
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
            if (modeAfterDownload) {
              actions.setPendingInterlinearDownload(true, modeAfterDownload, locale)
            }
            downloadManager.enqueue(plan)
          },
        },
      ]
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

    await requestDownload(
      preferredLocale,
      t(
        mode === 'interlinear' ? 'Interlinéaire' : mode === 'strong' ? 'Strong' : 'Translittération'
      ),
      mode,
      resolvedAvailability[preferredLocale]
    )
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
        onPress={() =>
          available
            ? selectLocale(locale)
            : requestDownload(
                locale,
                `${t('Interlinéaire')} ${label}`,
                undefined,
                availability[locale]
              )
        }
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

  const hasLoadedAvailability = Boolean(availability.fr && availability.en)
  const preferredAvailable = isAvailable(selectedLocale)
  const fallbackLocale: ResourceLanguage = selectedLocale === 'fr' ? 'en' : 'fr'
  const fallbackAvailable = isAvailable(fallbackLocale)
  const interlinearDownloadRequired = hasLoadedAvailability && !preferredAvailable
  const fallbackCapableDownloadRequired =
    hasLoadedAvailability && !preferredAvailable && !fallbackAvailable
  const pendingMode = bible.data.pendingInterlinearMode
  const pendingLocale = bible.data.pendingInterlinearLocale
  const pendingDownload = getDownload(pendingLocale ?? selectedLocale)
  const getModeDownloadState = (mode: InterlinearDisplayMode) => {
    const downloading =
      Boolean(bible.data.pendingInterlinearDownload) &&
      pendingMode === mode &&
      pendingLocale === selectedLocale
    return {
      downloading,
      progress: pendingDownload ? getDownloadItemProgress(pendingDownload) : 0,
    }
  }
  const interlinearDownloadState = getModeDownloadState('interlinear')
  const strongDownloadState = getModeDownloadState('strong')
  const transliterationDownloadState = getModeDownloadState('transliteration')
  const downloadLabel = (mode: string) => t('Télécharger les ressources pour {{mode}}', { mode })

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
            downloadRequired={interlinearDownloadRequired}
            downloading={interlinearDownloadState.downloading}
            downloadProgress={interlinearDownloadState.progress}
            downloadAccessibilityLabel={downloadLabel(t('Interlinéaire'))}
            onDownloadPress={() =>
              requestDownload(
                selectedLocale,
                t('Interlinéaire'),
                'interlinear',
                availability[selectedLocale]
              )
            }
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
            downloadRequired={fallbackCapableDownloadRequired}
            downloading={strongDownloadState.downloading}
            downloadProgress={strongDownloadState.progress}
            downloadAccessibilityLabel={downloadLabel(t('Strong'))}
            onDownloadPress={() =>
              requestDownload(selectedLocale, t('Strong'), 'strong', availability[selectedLocale])
            }
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
            downloadRequired={fallbackCapableDownloadRequired}
            downloading={transliterationDownloadState.downloading}
            downloadProgress={transliterationDownloadState.progress}
            downloadAccessibilityLabel={downloadLabel(t('Translittération'))}
            onDownloadPress={() =>
              requestDownload(
                selectedLocale,
                t('Translittération'),
                'transliteration',
                availability[selectedLocale]
              )
            }
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
