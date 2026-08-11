import { Feather } from '@expo/vector-icons'
import type { RefObject } from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'

import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { OfflineSetupReviewFolderContext } from '../offlineSetupReview'
import type { OfflineSetupPalette } from '../offlineSetupPalette'
import formatResourceSize from '../formatResourceSize'
import OfflineResourceFolderBadge from './OfflineResourceFolderBadge'

type OfflineSetupReviewHeaderProps = {
  downloadBytes: number
  folderBadgeRef: RefObject<View | null>
  folderContext?: OfflineSetupReviewFolderContext
  height: number
  installedBytes: number
  lang: ResourceLanguage
  palette: OfflineSetupPalette
  onFolderBadgeLayout: () => void
}

const OfflineSetupFolderReviewHeader = ({
  context,
  folderBadgeRef,
  height,
  installedBytes,
  lang,
  onFolderBadgeLayout,
  palette,
}: {
  context: OfflineSetupReviewFolderContext
  folderBadgeRef: RefObject<View | null>
  height: number
  installedBytes: number
  lang: ResourceLanguage
  palette: OfflineSetupPalette
  onFolderBadgeLayout: () => void
}) => {
  const { t } = useTranslation()

  return (
    <HStack height={height} alignItems="center" px={12} gap={13} style={{ overflow: 'visible' }}>
      <View
        ref={folderBadgeRef}
        collapsable={false}
        onLayout={onFolderBadgeLayout}
        style={{ opacity: context.heroOverlayActive ? 0 : 1, overflow: 'visible' }}
      >
        <OfflineResourceFolderBadge itemCount={context.selectedCount} visual={context.visual} />
      </View>
      <Box flex>
        <Text color={palette.onSheet} title fontSize={14} lineHeight={17} numberOfLines={1}>
          {context.title}
        </Text>
        <Text color={palette.onSheetMuted} fontSize={10} lineHeight={14} numberOfLines={1}>
          {t('offlineSetup.folderReviewSummary', {
            count: context.selectedCount,
            size: formatResourceSize(installedBytes, lang),
          })}
        </Text>
      </Box>
    </HStack>
  )
}

const OfflineSetupGlobalReviewHeader = ({
  downloadBytes,
  height,
  installedBytes,
  lang,
  palette,
}: {
  downloadBytes: number
  height: number
  installedBytes: number
  lang: ResourceLanguage
  palette: OfflineSetupPalette
}) => {
  const { t } = useTranslation()

  return (
    <HStack height={height} alignItems="center" px={12} gap={14}>
      <Box size={36} borderRadius={18} bg={palette.accent} center>
        <Feather name="archive" size={20} color={palette.onAccent} />
      </Box>
      <Box flex>
        <Text color={palette.onSheetMuted} fontSize={11}>
          {t('offlineSetup.toDownload')}
        </Text>
        <Text color={palette.onSheet} fontSize={18} style={{ fontFamily: 'FiraCode' }}>
          {formatResourceSize(downloadBytes, lang)}
        </Text>
      </Box>
      <Box height={34} width={1} bg={palette.divider} />
      <Box flex>
        <Text color={palette.onSheetMuted} fontSize={11}>
          {t('offlineSetup.onDevice')}
        </Text>
        <Text color={palette.onSheet} fontSize={18} style={{ fontFamily: 'FiraCode' }}>
          {formatResourceSize(installedBytes, lang)}
        </Text>
      </Box>
    </HStack>
  )
}

const OfflineSetupReviewHeader = ({
  downloadBytes,
  folderBadgeRef,
  folderContext,
  height,
  installedBytes,
  lang,
  onFolderBadgeLayout,
  palette,
}: OfflineSetupReviewHeaderProps) => {
  if (folderContext) {
    return (
      <OfflineSetupFolderReviewHeader
        context={folderContext}
        folderBadgeRef={folderBadgeRef}
        height={height}
        installedBytes={installedBytes}
        lang={lang}
        onFolderBadgeLayout={onFolderBadgeLayout}
        palette={palette}
      />
    )
  }

  return (
    <OfflineSetupGlobalReviewHeader
      downloadBytes={downloadBytes}
      height={height}
      installedBytes={installedBytes}
      lang={lang}
      palette={palette}
    />
  )
}

export default OfflineSetupReviewHeader
