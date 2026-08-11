import { Feather } from '@expo/vector-icons'
import type { RefObject } from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'

import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { OfflineSetupReviewFolderContext } from '../offlineSetupReview'
import formatResourceSize from '../formatResourceSize'
import OfflineResourceFolderBadge from './OfflineResourceFolderBadge'

type OfflineSetupReviewHeaderProps = {
  downloadBytes: number
  folderBadgeRef: RefObject<View | null>
  folderContext?: OfflineSetupReviewFolderContext
  height: number
  installedBytes: number
  lang: ResourceLanguage
  onFolderBadgeLayout: () => void
}

const OfflineSetupFolderReviewHeader = ({
  context,
  folderBadgeRef,
  height,
  installedBytes,
  lang,
  onFolderBadgeLayout,
}: {
  context: OfflineSetupReviewFolderContext
  folderBadgeRef: RefObject<View | null>
  height: number
  installedBytes: number
  lang: ResourceLanguage
  onFolderBadgeLayout: () => void
}) => {
  const { t } = useTranslation()

  return (
    <HStack height={height} alignItems="center" px={12} gap={13}>
      <View
        ref={folderBadgeRef}
        collapsable={false}
        onLayout={onFolderBadgeLayout}
        style={{ opacity: context.heroOverlayActive ? 0 : 1 }}
      >
        <OfflineResourceFolderBadge visual={context.visual} />
      </View>
      <Box flex>
        <Text color="#FFFFFF" title fontSize={14} lineHeight={17} numberOfLines={1}>
          {context.title}
        </Text>
        <Text color="#B8C2D1" fontSize={10} lineHeight={14} numberOfLines={1}>
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
}: {
  downloadBytes: number
  height: number
  installedBytes: number
  lang: ResourceLanguage
}) => {
  const { t } = useTranslation()

  return (
    <HStack height={height} alignItems="center" px={12} gap={14}>
      <Box size={36} borderRadius={18} bg="#5983F0" center>
        <Feather name="archive" size={20} color="#FFFFFF" />
      </Box>
      <Box flex>
        <Text color="#B8C2D1" fontSize={11}>
          {t('offlineSetup.toDownload')}
        </Text>
        <Text color="#FFFFFF" fontSize={18} style={{ fontFamily: 'FiraCode' }}>
          {formatResourceSize(downloadBytes, lang)}
        </Text>
      </Box>
      <Box height={34} width={1} bg="rgba(255,255,255,0.24)" />
      <Box flex>
        <Text color="#B8C2D1" fontSize={11}>
          {t('offlineSetup.onDevice')}
        </Text>
        <Text color="#FFFFFF" fontSize={18} style={{ fontFamily: 'FiraCode' }}>
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
      />
    )
  }

  return (
    <OfflineSetupGlobalReviewHeader
      downloadBytes={downloadBytes}
      height={height}
      installedBytes={installedBytes}
      lang={lang}
    />
  )
}

export default OfflineSetupReviewHeader
