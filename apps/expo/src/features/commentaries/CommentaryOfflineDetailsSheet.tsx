import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import type { CommentaryCatalogEntry } from '@bible-strong/resource-catalog/commentaries'
import { useTheme } from '~themes/ThemeProvider'
import React from 'react'

import { useTranslation } from 'react-i18next'
import { SheetScrollView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
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
  const confirmDeletion = useConfirmDialog()
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
    void confirmDeletion({
      title: t('Attention'),
      message: t('downloads.deleteConfirm'),
      cancelLabel: t('Non'),
      confirmLabel: t('Oui'),
      destructive: true,
    }).then(async confirmed => {
      if (!confirmed) return
      await deleteDownloadedItem(createDownloadedItemDeletionPlan(itemId))
    })
  }

  return (
    <Sheet ref={sheetRef} backgroundColor={theme.colors.reverse}>
      <SheetScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 32 }}
      >
        <Box className="overflow-hidden border-continuous flex-row items-center gap-[16px]">
          <CommentaryAvatar
            resourceCode={`${entry.publicationId}:${language}`}
            author={entry.author}
            fallback={entry.shortName}
            size={68}
          />
          <Box className="overflow-hidden border-continuous flex-[1] gap-[6px]">
            <Text className="text-[22px] font-bold" numberOfLines={3}>
              {entry.title}
            </Text>
            <Text className="text-tertiary text-[13px]" numberOfLines={2}>
              {entry.author}
            </Text>
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
              {t('commentaries.details.tradition').toUpperCase()}
            </Text>
            <Text className="text-[13px] font-bold text-center">{entry.tradition}</Text>
          </Box>
          <Box className="overflow-hidden border-continuous w-[1px] bg-border" />
          <Box className="overflow-hidden border-continuous flex-[1] items-center gap-[4px]">
            <Text className="text-tertiary text-[9px] font-bold">
              {t('bibleOfflineDetails.installedSize').toUpperCase()}
            </Text>
            <Text className="text-[13px] font-bold">{size}</Text>
          </Box>
        </Box>

        {!!description && (
          <Text className="mt-[22px] text-[15px] leading-[22px]">{description}</Text>
        )}

        <Box
          className="overflow-hidden border-continuous flex-row mt-[18px] gap-[8px]"
          style={{ flexWrap: 'wrap' }}
        >
          {entry.tags.map(tag => (
            <Box
              className="overflow-hidden border-continuous px-[10px] py-[6px] bg-light-grey rounded-[14px]"
              key={tag}
            >
              <Text className="text-[12px]">{tag}</Text>
            </Box>
          ))}
        </Box>

        <Box className="border-continuous overflow-hidden mt-[20px] pt-[16px] border-t-[1px] border-border">
          <Text className="text-tertiary text-[12px]">{entry.rights}</Text>
        </Box>

        {downloading ? (
          <Box className="overflow-hidden border-continuous mt-[22px] p-[16px] bg-light-grey rounded-[22px] flex-row items-center">
            <Progress progress={Math.max(progress, 0.04)} size={30} thickness={3} />
            <Text className="ml-[12px] flex-[1] font-bold">{Math.round(progress * 100)} %</Text>
            <TouchableBox
              className="overflow-hidden border-continuous px-[8px] py-[6px]"
              onPress={() => downloadManager.cancel(itemId)}
            >
              <Text className="text-quart font-bold">{t('bibleOfflineDetails.cancel')}</Text>
            </TouchableBox>
          </Box>
        ) : (
          <Box className="overflow-hidden border-continuous mt-[22px] p-[16px] bg-light-grey rounded-[22px] flex-row items-center gap-[10px]">
            <Box className="overflow-hidden border-continuous flex-[1]">
              <Button
                onPress={download}
                disabled={
                  !isConnected || (installed && publicationStatus.status !== 'update-available')
                }
                leftIcon={
                  !installed || corrupt || publicationStatus.status === 'update-available' ? (
                    <Box className="overflow-hidden border-continuous mr-[9px]">
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
                className="border-continuous overflow-hidden items-center justify-center bg-reverse rounded-[24px] border-[1px] border-border"
                accessibilityRole="button"
                accessibilityLabel={t('commentaries.selector.removeOffline')}
                onPress={remove}
                style={{ width: 48, height: 48 }}
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
