import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@emotion/react'
import { useAtomValue } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import React from 'react'
import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'

import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Box, { TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import Progress from '~common/ui/Progress'
import Text from '~common/ui/Text'
import type { Version } from '~helpers/bibleVersions'
import {
  createBibleDownloadItem,
  createStrongSidecarDownloadPlan,
} from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { getMobileResourceCatalogEntry } from '~helpers/mobileResourceCatalog'
import {
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import { getStrongBibleSidecarAvailability } from '~helpers/strongBibleSidecar'
import {
  createDownloadedItemDeletionPlan,
  deleteDownloadedItem,
} from '~helpers/deleteDownloadedItem'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { downloadCompletionSignalAtom, getDownloadItemProgress } from '~state/downloadQueue'
import { bibleDataRefreshSignalAtom, installedVersionsSignalAtom } from '~state/app'
import { useResourceAccess } from '~features/resources/resourceAccess'
import useConnection from '~helpers/useConnection'

const Detail = ({ label, value }: { label: string; value: string }) => (
  <Box flex>
    <Text fontSize={11} color="tertiary">
      {label}
    </Text>
    <Text fontSize={14} mt={2}>
      {value}
    </Text>
  </Box>
)

const StatusRow = ({
  label,
  status,
}: {
  label: string
  status: 'installed' | 'not-installed' | 'checking' | 'problem'
}) => {
  const { t } = useTranslation()
  const installed = status === 'installed'
  const problem = status === 'problem'

  return (
    <Box row alignItems="center" py={8}>
      <FeatherIcon
        name={
          installed
            ? 'check-circle'
            : problem
              ? 'alert-circle'
              : status === 'checking'
                ? 'clock'
                : 'circle'
        }
        size={17}
        color={installed ? 'success' : problem ? 'quart' : 'tertiary'}
      />
      <Text ml={10} fontSize={14}>
        {label}
      </Text>
      <Box flex />
      <Text fontSize={12} color="tertiary">
        {status === 'checking'
          ? t('bibleOfflineDetails.checking')
          : problem
            ? t('bibleOfflineDetails.needsRepair')
            : installed
              ? t('bibleOfflineDetails.installed')
              : t('bibleOfflineDetails.notDownloaded')}
      </Text>
    </Box>
  )
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
  const bibleQueue = useDownloadItemStatus(bibleId)
  const strongQueue = useDownloadItemStatus(strongId)

  const bibleAvailability = useQuery({
    queryKey: ['bible-offline-details', 'bible', versionId, installedSignal, completionSignal],
    enabled: Boolean(versionId),
    queryFn: () => resources.offlineCopies.isAvailable({ kind: 'bible', versionId: versionId! }),
  })
  const strongAvailability = useQuery({
    queryKey: [
      'bible-offline-details',
      'strong',
      strongVersionId,
      installedSignal,
      completionSignal,
    ],
    enabled: Boolean(strongVersionId),
    queryFn: () => getStrongBibleSidecarAvailability(strongVersionId!),
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
  const strongProblem = strongVersionId
    ? strongAvailability.data?.status === 'incompatible' ||
      strongAvailability.data?.status === 'corrupt'
    : false
  const bibleArtifact = getMobileResourceCatalogEntry(bibleId)
  const strongArtifact = strongId ? getMobileResourceCatalogEntry(strongId) : undefined
  const onlineStatus = resources.capabilities.getOnlineAccess({
    kind: 'bible-text',
    versionId,
  }).status
  const activeQueue = [bibleQueue, strongQueue].find(state =>
    state ? ['queued', 'downloading', 'inserting'].includes(state.status) : false
  )
  const failedQueue = [bibleQueue, strongQueue].find(state => state?.status === 'failed')
  const progress = activeQueue ? getDownloadItemProgress(activeQueue) : 0
  const formatSize = (bytes: number) =>
    t('downloads.size.mb', {
      value: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(
        bytes / 1_000_000
      ),
    })

  const refreshInstalledState = () => {
    const store = getDefaultStore()
    store.set(installedVersionsSignalAtom, current => current + 1)
    store.set(bibleDataRefreshSignalAtom, current => current + 1)
  }

  const downloadBible = () => {
    if (!isConnected) return
    downloadManager.enqueue([createBibleDownloadItem(versionId)])
  }

  const downloadBibleAndStrong = () => {
    if (!isConnected || !strongVersionId) return
    downloadManager.enqueue(
      createStrongSidecarDownloadPlan(
        strongVersionId,
        strongAvailability.data?.status ?? 'base-missing'
      )
    )
  }

  const removeStrong = () => {
    if (!strongId) return
    Alert.alert(t('Attention'), t('bibleOfflineDetails.removeStrongConfirm'), [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        style: 'destructive',
        onPress: async () => {
          await deleteDownloadedItem(createDownloadedItemDeletionPlan(strongId))
          refreshInstalledState()
        },
      },
    ])
  }

  const removeBible = () => {
    Alert.alert(
      t('Attention'),
      t(
        strongPresent
          ? 'bibleOfflineDetails.removeBibleWithStrongConfirm'
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
      strongId &&
      strongQueue &&
      ['queued', 'downloading', 'inserting'].includes(strongQueue.status)
    ) {
      downloadManager.cancel(strongId)
    }
  }

  return (
    <Sheet
      ref={sheetRef}
      backgroundColor={theme.colors.reverse}
      header={<SheetHeader title={version.displayName || version.name} subTitle={version.id} />}
    >
      <SheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}>
        <Text color="tertiary" fontSize={13} lineHeight={19}>
          {version.c}
        </Text>

        <Box mt={18} p={16} bg="lightGrey" borderRadius={16}>
          <Box row gap={16}>
            <Detail
              label={t('bibleOfflineDetails.archiveSize')}
              value={formatSize(bibleArtifact.archiveBytes)}
            />
            <Detail
              label={t('bibleOfflineDetails.installedSize')}
              value={formatSize(bibleArtifact.installedBytes)}
            />
          </Box>
          <Box mt={14} pt={12} borderTopWidth={1} borderColor="border">
            <StatusRow
              label={t('bibleOfflineDetails.bible')}
              status={
                bibleAvailability.isError
                  ? 'problem'
                  : bibleInstalled === undefined
                    ? 'checking'
                    : bibleInstalled
                      ? 'installed'
                      : 'not-installed'
              }
            />
            {strongVersionId && (
              <StatusRow
                label={t('versionSelector.strongIndex')}
                status={
                  strongAvailability.isError
                    ? 'problem'
                    : !strongAvailability.data
                      ? 'checking'
                      : strongProblem
                        ? 'problem'
                        : strongInstalled
                          ? 'installed'
                          : 'not-installed'
                }
              />
            )}
          </Box>
        </Box>

        <Box row alignItems="center" mt={14}>
          <FeatherIcon
            name={isConnected && onlineStatus === 'remotely-readable' ? 'wifi' : 'wifi-off'}
            size={16}
            color={isConnected && onlineStatus === 'remotely-readable' ? 'success' : 'tertiary'}
          />
          <Text ml={8} fontSize={13} color="tertiary">
            {t(
              !isConnected
                ? 'bibleOfflineDetails.offlineNow'
                : onlineStatus === 'remotely-readable'
                  ? 'resource.status.onlineAvailable'
                  : onlineStatus === 'temporarily-unavailable'
                    ? 'resource.status.onlineTemporary'
                    : 'resource.status.onlineUnsupported'
            )}
          </Text>
        </Box>

        {strongArtifact && (
          <Text mt={8} fontSize={12} color="tertiary">
            {t('bibleOfflineDetails.strongSize', {
              archive: formatSize(strongArtifact.archiveBytes),
              installed: formatSize(strongArtifact.installedBytes),
            })}
          </Text>
        )}

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
            <TouchableBox onPress={() => downloadManager.retry(failedQueue.item.id)} pt={10}>
              <Text color="primary" bold>
                {t('Réessayer')}
              </Text>
            </TouchableBox>
          </Box>
        )}

        {(bibleAvailability.isError || strongAvailability.isError) && (
          <TouchableBox
            onPress={() => {
              void bibleAvailability.refetch()
              if (strongVersionId) void strongAvailability.refetch()
            }}
            mt={14}
            py={8}
          >
            <Text color="primary" bold>
              {t('Réessayer')}
            </Text>
          </TouchableBox>
        )}

        {!activeQueue && !failedQueue && !bibleAvailability.isError && (
          <Box mt={22} gap={10}>
            {bibleInstalled === false && (
              <Button onPress={downloadBible} disabled={!isConnected}>
                {t('bibleOfflineDetails.downloadBible')}
              </Button>
            )}
            {bibleInstalled === false && strongVersionId && (
              <Button onPress={downloadBibleAndStrong} disabled={!isConnected} reverse>
                {t('bibleOfflineDetails.downloadBibleAndStrong')}
              </Button>
            )}
            {bibleInstalled === true &&
              strongVersionId &&
              strongAvailability.data &&
              !strongInstalled && (
                <Button onPress={downloadBibleAndStrong} disabled={!isConnected}>
                  {t('bibleOfflineDetails.downloadStrong')}
                </Button>
              )}
            {strongPresent && (
              <Button onPress={removeStrong} reverse>
                {t('bibleOfflineDetails.removeStrong')}
              </Button>
            )}
            {bibleInstalled === true && (
              <Button onPress={removeBible} color={theme.colors.quart}>
                {t(
                  strongPresent
                    ? 'bibleOfflineDetails.removeBibleAndStrong'
                    : 'bibleOfflineDetails.removeBible'
                )}
              </Button>
            )}
          </Box>
        )}
      </SheetScrollView>
    </Sheet>
  )
}

export default BibleOfflineDetailsSheet
