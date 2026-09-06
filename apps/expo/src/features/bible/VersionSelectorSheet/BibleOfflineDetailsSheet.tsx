import { useTheme } from '~themes/ThemeProvider'
import { getDefaultStore } from 'jotai/vanilla'
import React from 'react'
import { Alert, Platform, Switch } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetScrollView, type SheetRef } from '~common/sheet'
import Box, { TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import Progress from '~common/ui/Progress'
import Text from '~common/ui/Text'
import { getBooksForCanon } from '~helpers/bibleBookCatalog'
import type { Version } from '~helpers/bibleVersions'
import {
  createBibleDownloadItem,
  createInterlinearSidecarDownloadPlan,
  createStrongSidecarDownloadPlan,
} from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { getMobileResourceCatalogEntry } from '~helpers/mobileResourceCatalog'
import {
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import { isInterlinearCapableBibleVersion } from '~helpers/interlinearBiblePublications'
import {
  createDownloadedItemDeletionPlan,
  deleteDownloadedItem,
} from '~helpers/deleteDownloadedItem'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { getDownloadItemProgress } from '~state/downloadQueue'
import { bibleDataRefreshSignalAtom } from '~state/app'
import { useOfflineResourceState } from '~features/resources/useOfflineResourceRegistry'
import useConnection from '~helpers/useConnection'
import { getLanguage } from '~i18n'
const megabyteFormatters = new Map<string, Intl.NumberFormat>()

const formatMegabyteValue = (bytes: number, language: string) => {
  let formatter = megabyteFormatters.get(language)
  if (!formatter) {
    formatter = new Intl.NumberFormat(language, { maximumFractionDigits: 1 })
    megabyteFormatters.set(language, formatter)
  }
  return formatter.format(bytes / 1_000_000)
}

type Props = {
  sheetRef: React.RefObject<SheetRef | null>
  version?: Version & { displayName?: string }
}

const BibleOfflineDetailsSheet = ({ sheetRef, version }: Props) => {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const isConnected = useConnection()
  const versionId = version?.id
  const bibleId = versionId ? createOfflineCopyId({ kind: 'bible', versionId }) : undefined
  const strongVersionId =
    versionId && isStrongCapableBibleVersion(versionId)
      ? (versionId as StrongBibleVersionId)
      : undefined
  const strongId = strongVersionId
    ? createOfflineCopyId({ kind: 'strong-bible-index', versionId: strongVersionId })
    : undefined
  const interlinearLocale = getLanguage()
  const hasInterlinearIndex = Boolean(versionId && isInterlinearCapableBibleVersion(versionId))
  const interlinearId = hasInterlinearIndex
    ? createOfflineCopyId({
        kind: 'interlinear-index',
        versionId: 'BHG',
        language: interlinearLocale,
      })
    : undefined
  const bibleQueue = useDownloadItemStatus(bibleId)
  const strongQueue = useDownloadItemStatus(strongId)
  const interlinearQueue = useDownloadItemStatus(interlinearId)
  const bibleResourceState = useOfflineResourceState(bibleId)
  const strongResourceState = useOfflineResourceState(strongId)
  const interlinearResourceState = useOfflineResourceState(interlinearId)
  const [indexChoice, setIndexChoice] = React.useState({
    versionId,
    enabled: Boolean(strongVersionId || hasInterlinearIndex),
  })
  const includeIndex =
    indexChoice.versionId === versionId
      ? indexChoice.enabled
      : Boolean(strongVersionId || hasInterlinearIndex)

  if (!version || !versionId || !bibleId) return null

  const bibleInstalled = bibleResourceState
    ? bibleResourceState.availability.status === 'available'
    : undefined
  const strongInstalled = strongVersionId
    ? strongResourceState?.availability.status === 'available'
    : undefined
  const strongPresent = strongVersionId
    ? strongResourceState?.availability.status === 'available' ||
      strongResourceState?.availability.status === 'incompatible' ||
      strongResourceState?.availability.status === 'corrupt'
    : false
  const interlinearInstalled = hasInterlinearIndex
    ? interlinearResourceState?.availability.status === 'available'
    : undefined
  const indexInstalled = strongVersionId ? strongInstalled : interlinearInstalled
  const indexPresent = strongVersionId ? strongPresent : interlinearInstalled === true
  const bibleArtifact = getMobileResourceCatalogEntry(bibleId)
  const strongArtifact = strongId ? getMobileResourceCatalogEntry(strongId) : undefined
  const interlinearArtifact = interlinearId
    ? getMobileResourceCatalogEntry(interlinearId)
    : undefined
  const indexArtifact = strongArtifact ?? interlinearArtifact
  const indexId = strongId ?? interlinearId
  const activeQueue = [bibleQueue, strongQueue, interlinearQueue].find(state =>
    state ? ['queued', 'downloading', 'inserting'].includes(state.status) : false
  )
  const failedQueue = [bibleQueue, strongQueue, interlinearQueue].find(
    state => state?.status === 'failed'
  )
  const progress = activeQueue ? getDownloadItemProgress(activeQueue) : 0
  const availabilityReady =
    bibleResourceState !== undefined &&
    (!strongVersionId || strongResourceState !== undefined) &&
    (!hasInterlinearIndex || interlinearResourceState !== undefined)
  const languageKey = version.language === 'he-grc' ? 'heGrc' : version.language
  const languageLabel = t(`versionCatalog.language.${languageKey}`)
  const bookCount = getBooksForCanon(version.canonId ?? 'protestant-66').length
  const formatSize = (bytes: number) =>
    t('downloads.size.mb', {
      value: formatMegabyteValue(bytes, i18n.language),
    })
  const selectedArchiveBytes =
    bibleArtifact.archiveBytes + (includeIndex && indexArtifact ? indexArtifact.archiveBytes : 0)
  const shouldDownloadIndex =
    bibleInstalled === true &&
    Boolean(strongVersionId || hasInterlinearIndex) &&
    !indexInstalled &&
    includeIndex
  const indexMark = strongVersionId ? 'S' : hasInterlinearIndex ? 'I' : undefined
  const serifFontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif'

  const refreshInstalledState = () => {
    const store = getDefaultStore()
    store.set(bibleDataRefreshSignalAtom, current => current + 1)
  }

  const downloadBible = () => {
    if (!isConnected) return
    downloadManager.enqueue([createBibleDownloadItem(versionId)])
  }

  const downloadBibleAndIndex = () => {
    if (!isConnected) return
    if (strongVersionId) {
      downloadManager.enqueue(
        createStrongSidecarDownloadPlan(
          strongVersionId,
          bibleInstalled === false
            ? 'base-missing'
            : strongResourceState?.availability.status === 'core-missing'
              ? 'missing'
              : (strongResourceState?.availability.status ?? 'base-missing')
        )
      )
      return
    }
    if (hasInterlinearIndex) {
      downloadManager.enqueue(
        createInterlinearSidecarDownloadPlan(
          interlinearLocale,
          bibleInstalled === false ? 'base-missing' : 'missing'
        )
      )
    }
  }

  const removeBible = () => {
    Alert.alert(
      t('Attention'),
      t(
        indexPresent
          ? strongVersionId
            ? 'bibleOfflineDetails.removeBibleWithStrongConfirm'
            : 'bibleOfflineDetails.removeBibleWithInterlinearConfirm'
          : 'downloads.deleteConfirm'
      ),
      [
        { text: t('Non'), style: 'cancel' },
        {
          text: t('Oui'),
          style: 'destructive',
          onPress: async () => {
            await deleteDownloadedItem(createDownloadedItemDeletionPlan(bibleId))
            refreshInstalledState()
          },
        },
      ]
    )
  }

  const cancelDownload = () => {
    if (bibleQueue && ['queued', 'downloading', 'inserting'].includes(bibleQueue.status)) {
      downloadManager.cancel(bibleId)
    }
    if (
      indexId &&
      (strongQueue || interlinearQueue) &&
      ['queued', 'downloading', 'inserting'].includes((strongQueue ?? interlinearQueue)!.status)
    ) {
      downloadManager.cancel(indexId)
    }
  }

  return (
    <Sheet ref={sheetRef} backgroundColor={theme.colors.reverse}>
      <SheetScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 32 }}
      >
        <Box className="overflow-hidden border-continuous flex-row items-center gap-[16px]">
          <Box className="overflow-hidden border-continuous w-[78px] h-[94px] items-center justify-center bg-light-grey rounded-[14px]">
            <Box className="overflow-hidden border-continuous absolute left-[0px] top-[0px] bottom-[0px] w-[6px] bg-primary" />
            <Text
              className="w-[66px] pl-[6px] text-[22px] font-bold text-center"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              {version.id}
            </Text>
          </Box>
          <Box className="overflow-hidden border-continuous flex-[1] gap-[6px]">
            <Box className="overflow-hidden border-continuous flex-row items-center">
              <Text className="flex-[1] text-[22px] font-bold" numberOfLines={2}>
                {version.displayName || version.name}
              </Text>
              {indexMark && (
                <Text
                  className="ml-[8px] text-[22px] font-bold"
                  style={{ fontFamily: serifFontFamily }}
                >
                  {indexMark}
                </Text>
              )}
            </Box>
            {!!version.c && (
              <Text className="text-tertiary text-[13px]" numberOfLines={2}>
                {version.c}
              </Text>
            )}
          </Box>
        </Box>

        <Box className="border-continuous overflow-hidden flex-row mt-[22px] py-[14px] border-t-[1px] border-b-[1px] border-border">
          <Box className="overflow-hidden border-continuous flex-[1] items-center gap-[4px]">
            <Text className="text-tertiary text-[9px] font-bold">
              {t('bibleOfflineDetails.language').toUpperCase()}
            </Text>
            <Text className="text-[13px] font-bold">{languageLabel}</Text>
          </Box>
          <Box className="overflow-hidden border-continuous w-[1px] bg-border" />
          <Box className="overflow-hidden border-continuous flex-[1] items-center gap-[4px]">
            <Text className="text-tertiary text-[9px] font-bold">
              {t('bibleOfflineDetails.books').toUpperCase()}
            </Text>
            <Text className="text-[13px] font-bold">{bookCount}</Text>
          </Box>
          <Box className="overflow-hidden border-continuous w-[1px] bg-border" />
          <Box className="overflow-hidden border-continuous flex-[1] items-center gap-[4px]">
            <Text className="text-tertiary text-[9px] font-bold">
              {t('bibleOfflineDetails.installedSize').toUpperCase()}
            </Text>
            <Text className="text-[13px] font-bold">
              {formatSize(bibleArtifact.installedBytes)}
            </Text>
          </Box>
        </Box>

        {activeQueue && (
          <Box className="border-continuous overflow-hidden mt-[20px] p-[14px] border-[1px] border-border rounded-[14px]">
            <Box className="overflow-hidden border-continuous flex-row items-center">
              <Progress progress={Math.max(progress, 0.04)} size={30} thickness={3} />
              <Box className="overflow-hidden border-continuous ml-[12px] flex-[1]">
                <Text className="font-bold">{t('bibleOfflineDetails.downloading')}</Text>
                <Text className="text-tertiary text-[12px] mt-[2px]">
                  {Math.round(progress * 100)} %
                </Text>
              </Box>
              <TouchableBox
                className="overflow-hidden border-continuous px-[8px] py-[6px]"
                onPress={cancelDownload}
              >
                <Text className="text-quart font-bold">{t('bibleOfflineDetails.cancel')}</Text>
              </TouchableBox>
            </Box>
          </Box>
        )}

        {!activeQueue && failedQueue && (
          <Box className="border-continuous overflow-hidden mt-[20px] p-[14px] border-[1px] border-quart rounded-[14px]">
            <Text className="text-quart font-bold">{t('bibleOfflineDetails.downloadFailed')}</Text>
            <TouchableBox
              className="overflow-hidden border-continuous pt-[10px]"
              onPress={() => {
                if (failedQueue.item.id === indexId && bibleInstalled === false) {
                  downloadBibleAndIndex()
                  return
                }
                downloadManager.retry(failedQueue.item.id)
              }}
            >
              <Text className="text-primary font-bold">{t('Réessayer')}</Text>
            </TouchableBox>
          </Box>
        )}

        {!activeQueue && !failedQueue && !availabilityReady && (
          <Box className="overflow-hidden border-continuous flex-row items-center justify-center py-[32px]">
            <FeatherIcon name="clock" size={17} color="tertiary" />
            <Text className="ml-[9px] text-tertiary">{t('bibleOfflineDetails.checking')}</Text>
          </Box>
        )}

        {!activeQueue && !failedQueue && availabilityReady && (
          <Box className="overflow-hidden border-continuous mt-[22px] p-[16px] bg-light-grey rounded-[22px] gap-[14px]">
            {indexMark && indexArtifact && !indexInstalled && (
              <Box className="overflow-hidden border-continuous flex-row items-center p-[14px] bg-reverse rounded-[17px]">
                <Box
                  className="overflow-hidden border-continuous items-center justify-center bg-light-grey rounded-[13px]"
                  style={{ width: 42, height: 42 }}
                >
                  <Text className="text-[20px] font-bold" style={{ fontFamily: serifFontFamily }}>
                    {indexMark}
                  </Text>
                </Box>
                <Box className="overflow-hidden border-continuous ml-[12px] flex-[1] gap-[3px]">
                  <Text className="text-[14px] font-bold">
                    {t(
                      strongVersionId
                        ? 'bibleOfflineDetails.includeStrong'
                        : 'bibleOfflineDetails.includeInterlinear'
                    )}
                  </Text>
                  <Text className="text-tertiary text-[11px]">
                    {t('bibleOfflineDetails.indexOptionSubtitle', {
                      size: formatSize(indexArtifact.installedBytes),
                    })}
                  </Text>
                </Box>
                <Switch
                  accessibilityLabel={t('bibleOfflineDetails.indexOptionTitle')}
                  accessibilityState={{ checked: includeIndex }}
                  value={includeIndex}
                  onValueChange={enabled => setIndexChoice({ versionId, enabled })}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                />
              </Box>
            )}

            <Box className="overflow-hidden border-continuous flex-row items-center gap-[10px]">
              <Box className="overflow-hidden border-continuous flex-[1]">
                <Button
                  onPress={
                    bibleInstalled
                      ? downloadBibleAndIndex
                      : includeIndex && (strongVersionId || hasInterlinearIndex)
                        ? downloadBibleAndIndex
                        : downloadBible
                  }
                  disabled={!isConnected || (bibleInstalled === true && !shouldDownloadIndex)}
                  leftIcon={
                    bibleInstalled === false ? (
                      <Box className="overflow-hidden border-continuous mr-[9px]">
                        <FeatherIcon name="download" size={18} color="white" />
                      </Box>
                    ) : undefined
                  }
                >
                  {bibleInstalled
                    ? shouldDownloadIndex
                      ? t('bibleOfflineDetails.download')
                      : t('bibleOfflineDetails.bibleDownloaded')
                    : t('bibleOfflineDetails.downloadSize', {
                        size: formatSize(selectedArchiveBytes),
                      })}
                </Button>
              </Box>
              {bibleInstalled && (
                <TouchableBox
                  className="border-continuous overflow-hidden items-center justify-center bg-reverse rounded-[24px] border-[1px] border-border"
                  accessibilityRole="button"
                  accessibilityLabel={t('bibleOfflineDetails.removeBible')}
                  onPress={removeBible}
                  style={{ width: 48, height: 48 }}
                >
                  <FeatherIcon name="trash-2" size={20} color="quart" />
                </TouchableBox>
              )}
            </Box>
          </Box>
        )}
      </SheetScrollView>
    </Sheet>
  )
}

export default BibleOfflineDetailsSheet
