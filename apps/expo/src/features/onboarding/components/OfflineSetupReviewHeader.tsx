import { resolveThemeColor, resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
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
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()

  return (
    <HStack
      className="overflow-hidden border-continuous items-center px-[12px] gap-[13px]"
      style={[{ height: height }, { overflow: 'visible' }]}
    >
      <View
        ref={folderBadgeRef}
        collapsable={false}
        onLayout={onFolderBadgeLayout}
        style={{ opacity: context.heroOverlayActive ? 0 : 1, overflow: 'visible' }}
      >
        <OfflineResourceFolderBadge itemCount={context.selectedCount} visual={context.visual} />
      </View>
      <Box className="overflow-hidden border-continuous flex-[1]">
        <Text
          className="text-[14px] leading-[17px]"
          numberOfLines={1}
          style={{
            color: resolveThemeColor(stylingTheme, palette.onSheet) || stylingTheme.colors.default,
            fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
          }}
        >
          {context.title}
        </Text>
        <Text
          className="text-[10px] leading-[14px]"
          numberOfLines={1}
          style={{
            color:
              resolveThemeColor(stylingTheme, palette.onSheetMuted) || stylingTheme.colors.default,
          }}
        >
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
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()

  return (
    <HStack
      className="overflow-hidden border-continuous items-center px-[12px] gap-[14px]"
      style={{ height: height }}
    >
      <Box
        className="overflow-hidden border-continuous rounded-[18px] items-center justify-center"
        style={{
          backgroundColor: resolveThemeColor(stylingTheme, palette.accent),
          width: 36,
          height: 36,
        }}
      >
        <Feather name="archive" size={20} color={palette.onAccent} />
      </Box>
      <Box className="overflow-hidden border-continuous flex-[1]">
        <Text
          className="text-[11px]"
          style={{
            color:
              resolveThemeColor(stylingTheme, palette.onSheetMuted) || stylingTheme.colors.default,
          }}
        >
          {t('offlineSetup.toDownload')}
        </Text>
        <Text
          className="text-[18px]"
          style={[
            {
              color:
                resolveThemeColor(stylingTheme, palette.onSheet) || stylingTheme.colors.default,
            },
            { fontFamily: 'FiraCode' },
          ]}
        >
          {formatResourceSize(downloadBytes, lang)}
        </Text>
      </Box>
      <Box
        className="overflow-hidden border-continuous h-[34px] w-[1px]"
        style={{ backgroundColor: resolveThemeColor(stylingTheme, palette.divider) }}
      />
      <Box className="overflow-hidden border-continuous flex-[1]">
        <Text
          className="text-[11px]"
          style={{
            color:
              resolveThemeColor(stylingTheme, palette.onSheetMuted) || stylingTheme.colors.default,
          }}
        >
          {t('offlineSetup.onDevice')}
        </Text>
        <Text
          className="text-[18px]"
          style={[
            {
              color:
                resolveThemeColor(stylingTheme, palette.onSheet) || stylingTheme.colors.default,
            },
            { fontFamily: 'FiraCode' },
          ]}
        >
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
