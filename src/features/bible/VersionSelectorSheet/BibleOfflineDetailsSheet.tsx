import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@emotion/react'
import { useAtomValue } from 'jotai/react'
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
import { downloadCompletionSignalAtom, getDownloadItemProgress } from '~state/downloadQueue'
import { bibleDataRefreshSignalAtom, installedVersionsSignalAtom } from '~state/app'
import { useResourceAccess } from '~features/resources/resourceAccess'
import useConnection from '~helpers/useConnection'
import { getLanguage } from '~i18n'
import {
  getBibleOfflineDetailsQueryKey,
  getInterlinearOfflineDetailsQueryKey,
  getStrongOfflineDetailsQueryKey,
} from './bibleOfflineDetailsQueryKeys'

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
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const installedSignal = useAtomValue(installedVersionsSignalAtom)
  const completionSignal = useAtomValue(downloadCompletionSignalAtom)
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
  const [indexChoice, setIndexChoice] = React.useState({
    versionId,
    enabled: Boolean(strongVersionId || hasInterlinearIndex),
  })
  const includeIndex =
    indexChoice.versionId === versionId
      ? indexChoice.enabled
      : Boolean(strongVersionId || hasInterlinearIndex)

  const bibleAvailability = useQuery({
    queryKey: getBibleOfflineDetailsQueryKey(versionId!, installedSignal, completionSignal),
    enabled: Boolean(versionId),
    queryFn: () => resources.offlineCopies.isAvailable({ kind: 'bible', versionId: versionId! }),
  })
  const strongAvailability = useQuery({
    queryKey: getStrongOfflineDetailsQueryKey(
      strongVersionId ?? versionId ?? '',
      installedSignal,
      completionSignal
    ),
    enabled: Boolean(strongVersionId),
    queryFn: () => resources.strongBible.getAvailability(strongVersionId!),
  })
  const interlinearAvailability = useQuery({
    queryKey: getInterlinearOfflineDetailsQueryKey(
      interlinearLocale,
      installedSignal,
      completionSignal
    ),
    enabled: hasInterlinearIndex,
    queryFn: () =>
      resources.offlineCopies.isAvailable({
        kind: 'interlinear-index',
        versionId: 'BHG',
        language: interlinearLocale,
      }),
  })

  if (!version || !versionId || !bibleId) return null

  const bibleInstalled = bibleAvailability.data
  const strongInstalled = strongVersionId
    ? strongAvailability.data?.status === 'available'
    : undefined
  const strongPresent = strongVersionId
    ? strongAvailability.data?.status === 'available' ||
      strongAvailability.data?.status === 'incompatible' ||
      strongAvailability.data?.status === 'corrupt'
    : false
  const interlinearInstalled = hasInterlinearIndex ? interlinearAvailability.data : undefined
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
    bibleAvailability.data !== undefined &&
    (!strongVersionId || strongAvailability.data !== undefined) &&
    (!hasInterlinearIndex || interlinearAvailability.data !== undefined)
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
    store.set(installedVersionsSignalAtom, current => current + 1)
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
            : (strongAvailability.data?.status ?? 'base-missing')
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
        <Box row alignItems="center" gap={16}>
          <Box width={78} height={94} center bg="lightGrey" borderRadius={14}>
            <Box position="absolute" left={0} top={0} bottom={0} width={6} bg="primary" />
            <Text
              width={66}
              pl={6}
              fontSize={22}
              bold
              textAlign="center"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              {version.id}
            </Text>
          </Box>
          <Box flex gap={6}>
            <Box row alignItems="center">
              <Text flex fontSize={22} bold numberOfLines={2}>
                {version.displayName || version.name}
              </Text>
              {indexMark && (
                <Text ml={8} fontSize={22} bold style={{ fontFamily: serifFontFamily }}>
                  {indexMark}
                </Text>
              )}
            </Box>
            {!!version.c && (
              <Text color="tertiary" fontSize={13} numberOfLines={2}>
                {version.c}
              </Text>
            )}
          </Box>
        </Box>

        <Box row mt={22} py={14} borderTopWidth={1} borderBottomWidth={1} borderColor="border">
          <Box flex alignItems="center" gap={4}>
            <Text color="tertiary" fontSize={9} bold>
              {t('bibleOfflineDetails.language').toUpperCase()}
            </Text>
            <Text fontSize={13} bold>
              {languageLabel}
            </Text>
          </Box>
          <Box width={1} bg="border" />
          <Box flex alignItems="center" gap={4}>
            <Text color="tertiary" fontSize={9} bold>
              {t('bibleOfflineDetails.books').toUpperCase()}
            </Text>
            <Text fontSize={13} bold>
              {bookCount}
            </Text>
          </Box>
          <Box width={1} bg="border" />
          <Box flex alignItems="center" gap={4}>
            <Text color="tertiary" fontSize={9} bold>
              {t('bibleOfflineDetails.installedSize').toUpperCase()}
            </Text>
            <Text fontSize={13} bold>
              {formatSize(bibleArtifact.installedBytes)}
            </Text>
          </Box>
        </Box>

        {activeQueue && (
          <Box mt={20} p={14} borderWidth={1} borderColor="border" borderRadius={14}>
            <Box row alignItems="center">
              <Progress progress={Math.max(progress, 0.04)} size={30} thickness={3} />
              <Box ml={12} flex>
                <Text bold>{t('bibleOfflineDetails.downloading')}</Text>
                <Text color="tertiary" fontSize={12} mt={2}>
                  {Math.round(progress * 100)} %
                </Text>
              </Box>
              <TouchableBox onPress={cancelDownload} px={8} py={6}>
                <Text color="quart" bold>
                  {t('bibleOfflineDetails.cancel')}
                </Text>
              </TouchableBox>
            </Box>
          </Box>
        )}

        {!activeQueue && failedQueue && (
          <Box mt={20} p={14} borderWidth={1} borderColor="quart" borderRadius={14}>
            <Text color="quart" bold>
              {t('bibleOfflineDetails.downloadFailed')}
            </Text>
            <TouchableBox
              onPress={() => {
                if (failedQueue.item.id === indexId && bibleInstalled === false) {
                  downloadBibleAndIndex()
                  return
                }
                downloadManager.retry(failedQueue.item.id)
              }}
              pt={10}
            >
              <Text color="primary" bold>
                {t('Réessayer')}
              </Text>
            </TouchableBox>
          </Box>
        )}

        {(bibleAvailability.isError ||
          (strongVersionId && strongAvailability.isError) ||
          (hasInterlinearIndex && interlinearAvailability.isError)) && (
          <TouchableBox
            onPress={() => {
              void bibleAvailability.refetch()
              if (strongVersionId) void strongAvailability.refetch()
              if (hasInterlinearIndex) void interlinearAvailability.refetch()
            }}
            mt={14}
            py={8}
          >
            <Text color="primary" bold>
              {t('Réessayer')}
            </Text>
          </TouchableBox>
        )}

        {!activeQueue &&
          !failedQueue &&
          !bibleAvailability.isError &&
          !strongAvailability.isError &&
          !interlinearAvailability.isError &&
          !availabilityReady && (
            <Box row alignItems="center" justifyContent="center" py={32}>
              <FeatherIcon name="clock" size={17} color="tertiary" />
              <Text ml={9} color="tertiary">
                {t('bibleOfflineDetails.checking')}
              </Text>
            </Box>
          )}

        {!activeQueue && !failedQueue && availabilityReady && (
          <Box mt={22} p={16} bg="lightGrey" borderRadius={22} gap={14}>
            {indexMark && indexArtifact && !indexInstalled && (
              <Box row alignItems="center" p={14} bg="reverse" borderRadius={17}>
                <Box size={42} center bg="lightGrey" borderRadius={13}>
                  <Text fontSize={20} bold style={{ fontFamily: serifFontFamily }}>
                    {indexMark}
                  </Text>
                </Box>
                <Box ml={12} flex gap={3}>
                  <Text fontSize={14} bold>
                    {t(
                      strongVersionId
                        ? 'bibleOfflineDetails.includeStrong'
                        : 'bibleOfflineDetails.includeInterlinear'
                    )}
                  </Text>
                  <Text color="tertiary" fontSize={11}>
                    {t('bibleOfflineDetails.indexOptionSubtitle', {
                      size: formatSize(indexArtifact.installedBytes),
                    })}
                  </Text>
                </Box>
                <Switch
                  value={includeIndex}
                  onValueChange={enabled => setIndexChoice({ versionId, enabled })}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                />
              </Box>
            )}

            <Box row alignItems="center" gap={10}>
              <Box flex>
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
                      <Box mr={9}>
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
                  accessibilityRole="button"
                  accessibilityLabel={t('bibleOfflineDetails.removeBible')}
                  onPress={removeBible}
                  size={48}
                  center
                  bg="reverse"
                  borderRadius={24}
                  borderWidth={1}
                  borderColor="border"
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
