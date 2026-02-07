import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated from 'react-native-reanimated'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useDownloadQueue } from '~helpers/useDownloadQueue'

const GlobalDownloadBar = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { activeQueue, overallProgress, cancelAll } = useDownloadQueue()

  const isVisible = activeQueue.length > 0

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        transform: [{ translateY: isVisible ? 0 : 100 }],
        transitionProperty: 'transform',
        transitionDuration: 300,
        transitionTimingFunction: 'ease-out',
      }}
    >
      <Box
        bg="reverse"
        borderTopLeftRadius={16}
        borderTopRightRadius={16}
        px={20}
        pt={16}
        pb={insets.bottom > 0 ? insets.bottom : 16}
        lightShadow
      >
        <Box row alignItems="center" gap={12}>
          <Box flex>
            <Text fontSize={14} bold numberOfLines={1}>
              {t('downloads.progress', {
                current: overallProgress.completed + 1,
                total: overallProgress.total,
              })}
            </Text>
            <Box mt={8} height={4} borderRadius={2} bg="border" overflow="hidden">
              <Animated.View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: theme.colors.primary,
                  width: `${Math.round(overallProgress.progress * 100)}%` as any,
                  transitionProperty: 'width',
                  transitionDuration: 150,
                }}
              />
            </Box>
          </Box>

          <Text fontSize={13} color="tertiary" bold>
            {Math.round(overallProgress.progress * 100)}%
          </Text>

          <TouchableOpacity
            onPress={cancelAll}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text fontSize={13} color="quart" bold>
              {t('Annuler')}
            </Text>
          </TouchableOpacity>
        </Box>
      </Box>
    </Animated.View>
  )
}

export default GlobalDownloadBar
