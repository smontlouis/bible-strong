import type { CommentaryCatalogEntry } from '@bible-strong/resource-catalog/commentaries'
import { useTheme } from '@emotion/react'
import React from 'react'
import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'

import { Sheet, SheetScrollView, type SheetRef } from '~common/sheet'
import Box, { TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import Progress from '~common/ui/Progress'
import Text from '~common/ui/Text'
import {
  useIsOfflineResourceInstalled,
  useOfflineResourceState,
} from '~features/resources/useOfflineResourceRegistry'
import {
  createDownloadedItemDeletionPlan,
  deleteDownloadedItem,
} from '~helpers/deleteDownloadedItem'
import { createCommentaryDownloadItem } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getMobileResourceCatalogEntry } from '~helpers/mobileResourceCatalog'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import useConnection from '~helpers/useConnection'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { useResourcePublicationStatus } from '~helpers/useResourcePublicationStatus'
import { getDownloadItemProgress } from '~state/downloadQueue'
import CommentaryAvatar from './CommentaryAvatar'

type CommentaryProjection = {
  entry: CommentaryCatalogEntry
  language: ResourceLanguage
}

type Props = {
  sheetRef: React.RefObject<SheetRef | null>
  projection?: CommentaryProjection
}

const formatMegabytes = (bytes: number, language: string) =>
  new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(bytes / 1_000_000)

const CommentaryOfflineDetailsSheet = ({ sheetRef, projection }: Props) => {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const isConnected = useConnection()
  const identity = projection
    ? {
        kind: 'commentary' as const,
        resourceId: projection.entry.publicationId,
        language: projection.language,
      }
    : undefined
  const itemId = identity ? createOfflineCopyId(identity) : undefined
  const queueState = useDownloadItemStatus(itemId)
  const installed = useIsOfflineResourceInstalled(identity)
  const offlineState = useOfflineResourceState(identity)
  const corrupt = offlineState?.availability.status === 'corrupt'
  const publicationStatus = useResourcePublicationStatus({
    resourceId: itemId ?? '',
    isInstalled: installed,
  })
  const downloading =
    queueState && ['queued', 'downloading', 'inserting'].includes(queueState.status)
  const progress = queueState ? getDownloadItemProgress(queueState) : 0

  if (!projection || !identity || !itemId) return null

  const { entry, language } = projection
  const artifact = getMobileResourceCatalogEntry(itemId)
  const description = entry.description[language]
  const languageLabel = t(`versionCatalog.language.${language}`)
  const size = t('downloads.size.mb', {
    value: formatMegabytes(artifact.installedBytes, i18n.language),
  })

  const download = () => {
    if (!isConnected) return
    downloadManager.enqueue([createCommentaryDownloadItem(identity, entry.title)])
  }

  const remove = () => {
    Alert.alert(t('Attention'), t('downloads.deleteConfirm'), [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        style: 'destructive',
        onPress: async () => {
          await deleteDownloadedItem(createDownloadedItemDeletionPlan(itemId))
        },
      },
    ])
  }

  return (
    <Sheet ref={sheetRef} backgroundColor={theme.colors.reverse}>
      <SheetScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 32 }}
      >
        <Box row alignItems="center" gap={16}>
          <CommentaryAvatar
            resourceCode={`${entry.publicationId}:${language}`}
            author={entry.author}
            fallback={entry.shortName}
            size={68}
          />
          <Box flex gap={6}>
            <Text fontSize={22} bold numberOfLines={3}>
              {entry.title}
            </Text>
            <Text color="tertiary" fontSize={13} numberOfLines={2}>
              {entry.author}
            </Text>
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
              {t('commentaries.details.tradition').toUpperCase()}
            </Text>
            <Text fontSize={13} bold textAlign="center">
              {entry.tradition}
            </Text>
          </Box>
          <Box width={1} bg="border" />
          <Box flex alignItems="center" gap={4}>
            <Text color="tertiary" fontSize={9} bold>
              {t('bibleOfflineDetails.installedSize').toUpperCase()}
            </Text>
            <Text fontSize={13} bold>
              {size}
            </Text>
          </Box>
        </Box>

        {!!description && (
          <Text mt={22} fontSize={15} lineHeight={22}>
            {description}
          </Text>
        )}

        <Box row mt={18} gap={8} style={{ flexWrap: 'wrap' }}>
          {entry.tags.map(tag => (
            <Box key={tag} px={10} py={6} bg="lightGrey" borderRadius={14}>
              <Text fontSize={12}>{tag}</Text>
            </Box>
          ))}
        </Box>

        <Box mt={20} pt={16} borderTopWidth={1} borderColor="border">
          <Text color="tertiary" fontSize={12}>
            {entry.rights}
          </Text>
        </Box>

        {downloading ? (
          <Box mt={22} p={16} bg="lightGrey" borderRadius={22} row alignItems="center">
            <Progress progress={Math.max(progress, 0.04)} size={30} thickness={3} />
            <Text ml={12} flex bold>
              {Math.round(progress * 100)} %
            </Text>
            <TouchableBox onPress={() => downloadManager.cancel(itemId)} px={8} py={6}>
              <Text color="quart" bold>
                {t('bibleOfflineDetails.cancel')}
              </Text>
            </TouchableBox>
          </Box>
        ) : (
          <Box mt={22} p={16} bg="lightGrey" borderRadius={22} row alignItems="center" gap={10}>
            <Box flex>
              <Button
                onPress={download}
                disabled={
                  !isConnected || (installed && publicationStatus.status !== 'update-available')
                }
                leftIcon={
                  !installed || corrupt || publicationStatus.status === 'update-available' ? (
                    <Box mr={9}>
                      <FeatherIcon name="download" size={18} color="white" />
                    </Box>
                  ) : undefined
                }
              >
                {corrupt
                  ? t('resource.action.repairOfflineCopy')
                  : publicationStatus.status === 'update-available'
                    ? t('commentaries.details.update')
                    : installed
                      ? t('commentaries.selector.downloaded')
                      : t('bibleOfflineDetails.downloadSize', {
                          size: t('downloads.size.mb', {
                            value: formatMegabytes(artifact.archiveBytes, i18n.language),
                          }),
                        })}
              </Button>
            </Box>
            {installed && (
              <TouchableBox
                accessibilityRole="button"
                accessibilityLabel={t('commentaries.selector.removeOffline')}
                onPress={remove}
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
        )}
      </SheetScrollView>
    </Sheet>
  )
}

export default CommentaryOfflineDetailsSheet
