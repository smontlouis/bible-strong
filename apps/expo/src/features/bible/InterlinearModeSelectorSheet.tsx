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
import { downloadItemStatesAtom, getDownloadItemProgress } from '~state/downloadQueue'
import { useBibleTabActions, type BibleTab } from '~state/tabs'
import { getBibleModeAcquisitionPresentation } from '~helpers/bibleModeAcquisition'
import BibleDisplayModeCard from './BibleDisplayModeCard'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { useResourceAccess } from '~features/resources/resourceAccess'
import useConnection from '~helpers/useConnection'
import {
  loadInterlinearModeAvailability,
  type InterlinearModeAvailabilityState,
} from './loadInterlinearModeAvailability'
import { localQueryOptions } from '~helpers/queryOptions'
import {
  getOfflineResourceQuerySignal,
  useOfflineResourceRegistry,
} from '~features/resources/useOfflineResourceRegistry'
type Props = {
  bibleAtom: PrimitiveAtom<BibleTab>
  sheetRef?: RefObject<SheetRef | null>
  inline?: boolean
  onClose?: () => void
}

type AvailabilityByLocale = Partial<Record<ResourceLanguage, InterlinearSidecarAvailability>>
type DisplayMode = 'hidden' | InterlinearDisplayMode

const isActiveDownload = (status?: string) =>
  status === 'queued' || status === 'downloading' || status === 'inserting'

const InterlinearModeSelectorSheet = ({ bibleAtom, sheetRef, inline = false, onClose }: Props) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const appLanguage = useLanguage()
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const resourceRegistry = useOfflineResourceRegistry()
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
      englishDownload?.status,
      frenchDownload?.status,
    ],
    queryFn: () =>
      loadInterlinearModeAvailability(resources.lexiconBible.getInterlinearAvailability),
    ...localQueryOptions,
  })
  const availability: AvailabilityByLocale = availabilityQuery.data ?? {}
  const availabilityFailed = availabilityQuery.isError

  const getDownload = (locale: ResourceLanguage) =>
    locale === 'fr' ? frenchDownload : englishDownload

  const isAvailable = (locale: ResourceLanguage) => availability[locale]?.status === 'available'

  const requestDownload = async (
    locale: ResourceLanguage,
    _modeLabel: string,
    modeAfterDownload?: InterlinearDisplayMode,
    knownAvailability?: InterlinearSidecarAvailability
  ) => {
    if (Platform.OS === 'web') return
    if (!isConnected || availabilityFailed) return
    const resolvedAvailability =
      knownAvailability ??
      availability[locale] ??
      (await resources.lexiconBible.getInterlinearAvailability(locale).catch(() => undefined))
    if (!resolvedAvailability) return
    if (resolvedAvailability.status === 'available') {
      if (modeAfterDownload) {
        actions.setInterlinearMode(modeAfterDownload, locale)
        sheetRef?.current?.dismiss()
        onClose?.()
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
      actions.setInterlinearMode(mode, selectedLocale)
      sheetRef?.current?.dismiss()
      onClose?.()
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

    if (Platform.OS === 'web' && !available) return null

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
          className={twMerge(
            'overflow-hidden border-continuous',
            twMerge(
              selected && available ? 'bg-primary' : '',
              'overflow-hidden border-continuous flex-[1] flex-row items-center justify-center gap-[7px]'
            )
          )}
          style={{ opacity: available || downloading ? 1 : 0.65 }}
        >
          <Text
            className={twMerge(
              selected && available ? 'text-reverse' : 'text-default',
              'font-bold text-[14px]'
            )}
          >
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

  const hasLoadedAvailability = availabilityQuery.isSuccess
  const preferredAvailable = isAvailable(selectedLocale)
  const fallbackLocale: ResourceLanguage = selectedLocale === 'fr' ? 'en' : 'fr'
  const fallbackAvailable = isAvailable(fallbackLocale)
  const interlinearDownloadRequired =
    Platform.OS !== 'web' && hasLoadedAvailability && !preferredAvailable
  const fallbackCapableDownloadRequired =
    Platform.OS !== 'web' && hasLoadedAvailability && !preferredAvailable && !fallbackAvailable
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
            disabled={Platform.OS === 'web' && !preferredAvailable}
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
            disabled={Platform.OS === 'web' && !preferredAvailable && !fallbackAvailable}
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
            disabled={Platform.OS === 'web' && !preferredAvailable && !fallbackAvailable}
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
              className="text-[20px] leading-[26px] text-center"
              style={{ fontFamily: serifFontFamily }}
            >
              {transliterationPreview}
            </Text>
          </BibleDisplayModeCard>
        </Box>

        {selectedMode === 'interlinear' && (
          <Box
            className="border-continuous overflow-hidden flex-row items-center gap-[12px] border-[1px] border-border rounded-[16px] p-[12px]"
            style={{
              backgroundColor: colorWithOpacity(resolveThemeColor(stylingTheme, 'reverse'), 0.2),
            }}
          >
            <Text className="flex-[1] font-bold text-[14px]">{t('Langue des gloses')}</Text>
            <Box className="border-continuous overflow-hidden flex-row w-[132px] h-[38px] border-[1px] border-border rounded-[10px]">
              {renderLocaleOption('fr', 'FR')}
              <Box className="overflow-hidden border-continuous w-[1px] bg-border" />
              {renderLocaleOption('en', 'EN')}
            </Box>
          </Box>
        )}
      </SheetView>
    </Container>
  )
}

export default InterlinearModeSelectorSheet
