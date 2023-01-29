import { useAtomValue } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { tabsCountQuota, useIsPremium } from '~helpers/usePremium'
import { fullscreenAtom } from '../../../state/app'
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
  const isFullscreen = useAtomValue(fullscreenAtom)
  const isPremium = useIsPremium()
  const bottomBarHeight = TAB_ICON_SIZE + getBottomSpace()
  const bottomBarStyles = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withTiming(isFullscreen ? bottomBarHeight : 0),
        },
      ],
    }
  })

  const tabsQuotaExceeded = tabsCount >= tabsCountQuota && !isPremium

  return (
    <AnimatedBox
      pb={getBottomSpace()}
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
        paddingBottom={getBottomSpace()}
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
        paddingBottom={getBottomSpace()}
        style={listStyles}
        key="list"
      >
        <AddTabButton />
        <Box flex center>
          <Text color={tabsQuotaExceeded ? 'quart' : 'default'}>
            {tabsCount}
            {!isPremium ? `/${tabsCountQuota}` : ''}{' '}
            {t('tabs.tab', { count: tabsCount })}
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
