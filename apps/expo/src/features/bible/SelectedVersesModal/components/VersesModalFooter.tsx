import { useTheme } from '~themes/ThemeProvider'
import { useTranslation } from 'react-i18next'
import type { GestureType } from 'react-native-gesture-handler'
import { GestureDetector } from 'react-native-gesture-handler'
import type { ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import Animated from 'react-native-reanimated'
import type { SheetFooterProps } from '~common/sheet'
import { AnimatedBox } from '~common/ui/Box'
import { TAB_CONTAINER_PADDING } from '../constants'
import TabButton from './TabButton'
interface VersesModalFooterProps {
  sheetFooterProps?: SheetFooterProps
  panGesture: GestureType
  indicatorAnimatedStyle: AnimatedStyle<ViewStyle>
  onContainerWidthChange: (width: number) => void
  tabWidth: number
  activeTabIndex: number
  goToTab: (index: number) => void
}

const VersesModalFooter = ({
  onContainerWidthChange,
  panGesture,
  indicatorAnimatedStyle,
  tabWidth,
  activeTabIndex,
  goToTab,
}: VersesModalFooterProps) => {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <AnimatedBox
      onLayout={event => onContainerWidthChange(event.nativeEvent.layout.width)}
      className="bg-light-grey rounded-[18px] p-[3px] mx-[16px] mb-[5px] relative"
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
            borderRadius: 14,
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
  )
}

export default VersesModalFooter
