import { useAtomValue } from 'jotai/react'
import { GestureDetector } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { isFullScreenBibleAtom } from 'src/state/app'
import { AnimatedBox, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { TAB_ICON_SIZE } from '../utils/constants'
import AddTabButton from './Buttons/AddTabButton'
import BibleButton from './Buttons/BibleButton'
import HomeButton from './Buttons/HomeButton'
import MenuButton from './Buttons/MenuButton'
import SearchButton from './Buttons/SearchButton'
import TabButton from './Buttons/TabButton'
import GroupTitleButton from './GroupTitleButton'
import useBottomTabBar from './useBottomTabBar'
import useTabBarSwipeGesture from './useTabBarSwipeGesture'
type BottomTabBarProps = {
  openMenu: () => void
  openHome: () => void
}

const BottomTabBar = ({ openMenu, openHome }: BottomTabBarProps) => {
  const { t } = useTranslation()
  const { onPress, isViewMode, listStyles, viewStyles } = useBottomTabBar()
  const { panGesture } = useTabBarSwipeGesture()
  const insets = useSafeAreaInsets()
  const bottomBarHeight = TAB_ICON_SIZE + insets.bottom
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)

  return (
    <AnimatedBox
      className="overflow-hidden border-continuous bg-reverse absolute bottom-[0px] left-[0px] right-[0px] border-t-[1px] border-border"
      style={[
        { paddingBottom: insets.bottom, height: bottomBarHeight },
        {
          transform: [{ translateY: isFullScreenBible ? bottomBarHeight : 0 }],
          transitionProperty: 'transform',
          transitionDuration: 300,
        },
      ]}
    >
      <GestureDetector gesture={panGesture}>
        <AnimatedBox
          className="overflow-hidden border-continuous flex-row items-center justify-around px-[20px] absolute left-[0px] top-[0px] right-[0px] bottom-[0px]"
          style={[{ paddingBottom: insets.bottom }, viewStyles]}
          accessibilityElementsHidden={!isViewMode}
          importantForAccessibility={isViewMode ? 'auto' : 'no-hide-descendants'}
          key="view"
        >
          <HomeButton openHome={openHome} />
          <SearchButton />
          <BibleButton />
          <TabButton />
          <MenuButton openMenu={openMenu} />
        </AnimatedBox>
      </GestureDetector>
      <AnimatedBox
        className="overflow-hidden border-continuous flex-row items-center justify-around px-[20px] absolute left-[0px] top-[0px] right-[0px] bottom-[0px]"
        style={[{ paddingBottom: insets.bottom }, listStyles]}
        accessibilityElementsHidden={isViewMode}
        importantForAccessibility={isViewMode ? 'no-hide-descendants' : 'auto'}
        key="list"
      >
        <AddTabButton />
        <GroupTitleButton />
        <TouchableBox
          className="overflow-hidden border-continuous items-center justify-center"
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.openSelectedTab')}
          style={{ ...(TAB_ICON_SIZE ? { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE } : {}) }}
        >
          <Text className="font-bold">OK</Text>
        </TouchableBox>
      </AnimatedBox>
    </AnimatedBox>
  )
}

export default BottomTabBar
