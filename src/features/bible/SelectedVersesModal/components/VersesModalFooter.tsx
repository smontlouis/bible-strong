import { useTheme } from '@emotion/react'
import type { BottomSheetFooterProps } from '@gorhom/bottom-sheet'
import { BottomSheetFooter } from '@gorhom/bottom-sheet'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import type { GestureType } from 'react-native-gesture-handler'
import { GestureDetector } from 'react-native-gesture-handler'
import type { AnimatedStyle, StyleProps } from 'react-native-reanimated'
import Animated from 'react-native-reanimated'
import { isFullScreenBibleAtom } from 'src/state/app'
import { AnimatedBox } from '~common/ui/Box'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { BOTTOM_INSET } from '~helpers/constants'
import { TAB_CONTAINER_PADDING } from '../constants'
import TabButton from './TabButton'

interface VersesModalFooterProps {
  bottomSheetFooterProps: BottomSheetFooterProps
  panGesture: GestureType
  indicatorAnimatedStyle: AnimatedStyle<StyleProps>
  tabWidth: number
  activeTabIndex: number
  goToTab: (index: number) => void
}

const VersesModalFooter = ({
  bottomSheetFooterProps,
  panGesture,
  indicatorAnimatedStyle,
  tabWidth,
  activeTabIndex,
  goToTab,
}: VersesModalFooterProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)
  const { bottomBarHeight } = useBottomBarHeightInTab()

  return (
    <BottomSheetFooter {...bottomSheetFooterProps}>
      <AnimatedBox
        bg="lightGrey"
        borderRadius={10}
        p={3}
        mx={16}
        mb={(isFullScreenBible ? BOTTOM_INSET : bottomBarHeight) + 10}
        position="relative"
        style={{
          transitionProperty: 'margin',
          transitionDuration: 300,
        }}
      >
        {/* Sliding indicator */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: TAB_CONTAINER_PADDING,
              bottom: TAB_CONTAINER_PADDING,
              width: tabWidth,
              backgroundColor: theme.colors.reverse,
              borderRadius: 8,
            },
            indicatorAnimatedStyle,
          ]}
        />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={{ flexDirection: 'row' }}>
            <TabButton
              label={t('tabs.annotate')}
              isActive={activeTabIndex === 0}
              onPress={() => goToTab(0)}
            />
            <TabButton
              label={t('tabs.study')}
              isActive={activeTabIndex === 1}
              onPress={() => goToTab(1)}
            />
            <TabButton
              label={t('tabs.share')}
              isActive={activeTabIndex === 2}
              onPress={() => goToTab(2)}
            />
          </Animated.View>
        </GestureDetector>
      </AnimatedBox>
    </BottomSheetFooter>
  )
}

export default VersesModalFooter
