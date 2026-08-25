import { useAtomValue } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useQuery } from '@tanstack/react-query'
import { type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, Pressable } from 'react-native'

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
import type { InterlinearSidecarAvailability } from '~helpers/interlinearBibleSidecar'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import useLanguage from '~helpers/useLanguage'
import {
  downloadCompletionSignalAtom,
  downloadItemStatesAtom,
  getDownloadItemProgress,
} from '~state/downloadQueue'
import { useBibleTabActions, type BibleTab } from '~state/tabs'
import { getBibleModeAcquisitionPresentation } from '~helpers/bibleModeAcquisition'
import BibleDisplayModeCard from './BibleDisplayModeCard'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { useResourceAccess } from '~features/resources/resourceAccess'
import useConnection from '~helpers/useConnection'

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
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const downloadStates = useAtomValue(downloadItemStatesAtom)
  const frenchDownload = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'interlinear-index', versionId: 'BHG', language: 'fr' })
  )
  const englishDownload = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'interlinear-index', versionId: 'BHG', language: 'en' })
  )
  const selectedMode = normalizeInterlinearMode(bible.data.interlinearMode)
  const selectedLocale: ResourceLanguage = bible.data.interlinearLocale ?? appLanguage
  const isHebrew = bible.data.selectedBook.Numero <= 39
  const originalPreview = isHebrew ? 'אֱלֹהִים' : 'λόγος'
  const transliterationPreview = isHebrew ? 'Elohim bara' : 'logos en'
  const glossPreview = isHebrew ? 'Dieu · H0430' : 'Parole · G3056'
  const serifFontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif'
  const pendingAcquisition =
    bible.data.pendingModeAcquisition?.kind === 'interlinear'
      ? bible.data.pendingModeAcquisition
      : undefined

  const availabilityQuery = useQuery<AvailabilityByLocale>({
    queryKey: [
      'interlinear-mode-availability',
      downloadCompletionSignal,
      englishDownload?.status,
      frenchDownload?.status,
    ],
    queryFn: async () => {
      const [fr, en] = await Promise.all([
        resources.lexiconBible.getInterlinearAvailability('fr'),
        resources.lexiconBible.getInterlinearAvailability('en'),
      ])
      return { fr, en }
    },
  })
  const availability = availabilityQuery.data ?? {}
  const availabilityFailed = availabilityQuery.isError

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
    _modeLabel: string,
    modeAfterDownload?: InterlinearDisplayMode,
    knownAvailability?: InterlinearSidecarAvailability
  ) => {
    if (!isConnected || availabilityFailed) return
    const resolvedAvailability =
      knownAvailability ??
      availability[locale] ??
      (await resources.lexiconBible.getInterlinearAvailability(locale).catch(() => undefined))
    if (!resolvedAvailability) return
    if (resolvedAvailability.status === 'available') {
      if (modeAfterDownload) {
        actions.setInterlinearMode(modeAfterDownload, locale)
        sheetRef.current?.dismiss()
      }
      return
    }

    const plan = createInterlinearSidecarDownloadPlan(locale, resolvedAvailability.status)
    if (modeAfterDownload) {
      actions.startBibleModeAcquisition({
        kind: 'interlinear',
        mode: modeAfterDownload,
        locale,
        planIds: plan.map(item => item.id),
      })
    }
    downloadManager.enqueue(plan)
  }

  const selectMode = async (mode: DisplayMode) => {
    if (mode === 'hidden') {
      if (bible.data.pendingModeAcquisition) {
        actions.finishBibleModeAcquisition(false)
      }
      actions.setInterlinearMode('hidden', selectedLocale)
      sheetRef.current?.dismiss()
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
      sheetRef.current?.dismiss()
      return
    }

    // Selecting a display mode never starts an Offline-copy transfer.
    // The dedicated acquisition control remains visible on the unavailable card.
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
        accessibilityState={{
          selected,
          disabled: availabilityFailed || downloading || (!available && !isConnected),
        }}
        accessibilityLabel={
          available
            ? label
            : t('Télécharger l’index interlinéaire {{language}}', { language: label })
        }
        disabled={availabilityFailed || downloading || (!available && !isConnected)}
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
              <FeatherIcon
                name={isConnected ? 'download-cloud' : 'wifi-off'}
                size={18}
                color="default"
              />
            ))}
        </Box>
      </Pressable>
    )
  }

  const hasLoadedAvailability =
    availabilityQuery.isSuccess && Boolean(availability.fr && availability.en)
  const preferredAvailable = isAvailable(selectedLocale)
  const fallbackLocale: ResourceLanguage = selectedLocale === 'fr' ? 'en' : 'fr'
  const fallbackAvailable = isAvailable(fallbackLocale)
  const interlinearDownloadRequired = hasLoadedAvailability && !preferredAvailable
  const fallbackCapableDownloadRequired =
    hasLoadedAvailability && !preferredAvailable && !fallbackAvailable
  const getModeDownloadState = (mode: InterlinearDisplayMode) => {
    const acquisition = pendingAcquisition?.mode === mode ? pendingAcquisition : undefined
    const presentation = getBibleModeAcquisitionPresentation(acquisition, downloadStates)
    return {
      downloading: Boolean(acquisition) && presentation.status !== 'failed',
      progress: presentation.progress,
    }
  }
  const interlinearDownloadState = getModeDownloadState('interlinear')
  const strongDownloadState = getModeDownloadState('strong')
  const transliterationDownloadState = getModeDownloadState('transliteration')
  const downloadLabel = (mode: string) =>
    isConnected
      ? t('Télécharger les ressources pour {{mode}}', { mode })
      : t('resource.action.connectionRequired')

  return (
    <Sheet ref={sheetRef} header={<SheetHeader title={t('Affichage du texte')} />}>
      <SheetView p={16} gap={10}>
        {availabilityFailed && (
          <Box center py={8}>
            <Text color="tertiary" textAlign="center">
              {t('resource.action.temporarilyUnavailable')}
            </Text>
            <Text bold color="primary" mt={8} onPress={() => void availabilityQuery.refetch()}>
              {t('bible.error.retry')}
            </Text>
          </Box>
        )}
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
            downloadDisabled={!isConnected || availabilityFailed}
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
            downloadDisabled={!isConnected || availabilityFailed}
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
            downloadDisabled={!isConnected || availabilityFailed}
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
