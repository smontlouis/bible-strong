import { useTranslation } from 'react-i18next'
import { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { TAB_ICON_SIZE } from '../utils/constants'
import AddTabButton from './Buttons/AddTabButton'
import BibleButton from './Buttons/BibleButton'
import HomeButton from './Buttons/HomeButton'
import MenuButton from './Buttons/MenuButton'
import SearchButton from './Buttons/SearchButton'
import TabButton from './Buttons/TabButton'
import useBottomTabBar from './useBottomTabBar'

type BottomTabBarProps = {
  openMenu: () => void
  openHome: () => void
}

const BottomTabBar = ({ openMenu, openHome }: BottomTabBarProps) => {
  const { onPress, listStyles, viewStyles, tabsCount } = useBottomTabBar()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const bottomBarHeight = TAB_ICON_SIZE + insets.bottom
  const bottomBarStyles = useAnimatedStyle(() => {
    return {
      transform: [
        {
          // @TODO: remove this once we have a proper fullscreen mode
          translateY: withTiming(false ? bottomBarHeight : 0),
        },
      ],
    }
  })

  return (
    <AnimatedBox
      pb={insets.bottom}
      bg="reverse"
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      borderTopWidth={1}
      borderColor="border"
      height={bottomBarHeight}
      style={bottomBarStyles}
    >
      <AnimatedBox
        row
        alignItems="center"
        justifyContent="space-around"
        px={20}
        absoluteFill
        paddingBottom={insets.bottom}
        style={viewStyles}
        key="view"
      >
        <HomeButton openHome={openHome} />
        <SearchButton />
        <BibleButton />
        <TabButton />
        <MenuButton openMenu={openMenu} />
      </AnimatedBox>
      <AnimatedBox
        row
        alignItems="center"
        justifyContent="space-around"
        px={20}
        absoluteFill
        paddingBottom={insets.bottom}
        style={listStyles}
        key="list"
      >
        <AddTabButton />
        <Box flex center>
          <Text color={'default'}>
            {tabsCount} {t('tabs.tab', { count: tabsCount })}
          </Text>
        </Box>
        <TouchableBox center size={TAB_ICON_SIZE} onPress={onPress}>
          <Text bold>OK</Text>
        </TouchableBox>
      </AnimatedBox>
    </AnimatedBox>
  )
}

export default BottomTabBar
