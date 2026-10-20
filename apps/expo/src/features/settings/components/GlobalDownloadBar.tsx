import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useTheme } from '~themes/ThemeProvider'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated from 'react-native-reanimated'
import { EaseView } from 'react-native-ease'
import Box from '~common/ui/Box'
import { floatingShadow } from '~common/ui/surfaces'
import Text from '~common/ui/Text'
import { useDownloadQueue } from '~helpers/useDownloadQueue'
const GlobalDownloadBar = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { activeQueue, overallProgress, cancelAll } = useDownloadQueue()

  const isVisible = activeQueue.length > 0

  return (
    <EaseView
      animate={{ translateY: isVisible ? 0 : 100 }}
      transition={{
        type: 'timing',
        duration: 300,
        easing: 'easeOut',
      }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <Box
        className="overflow-hidden border-continuous bg-surface-raised rounded-tl-[24px] rounded-tr-[24px] px-[20px] pt-[16px]"
        style={{
          paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
          ...floatingShadow,
          overflow: 'visible',
        }}
      >
        <Box className="overflow-hidden border-continuous flex-row items-center gap-[12px]">
          <Box className="overflow-hidden border-continuous flex-[1]">
            <Text className="text-[14px] font-bold" numberOfLines={1}>
              {t('downloads.progress', {
                current: overallProgress.completed + 1,
                total: overallProgress.total,
              })}
            </Text>
            <Box className="border-continuous overflow-visible mt-[8px] h-[4px] rounded-full bg-border">
              <Animated.View
                style={{
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: theme.colors.primary,
                  width: `${Math.round(overallProgress.progress * 100)}%`,
                  transitionProperty: 'width',
                  transitionDuration: 150,
                }}
              />
            </Box>
          </Box>

          <Text className="text-[13px] text-tertiary font-bold">
            {Math.round(overallProgress.progress * 100)}%
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={cancelAll}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text className="text-[13px] text-quart font-bold">{t('Annuler')}</Text>
          </TouchableOpacity>
        </Box>
      </Box>
    </EaseView>
  )
}

export default GlobalDownloadBar
