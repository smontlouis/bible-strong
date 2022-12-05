import React from 'react'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { AnimatedBox } from '~common/ui/Box'
import BibleButton from './Buttons/BibleButton'
import HomeButton from './Buttons/HomeButton'
import MenuButton from './Buttons/MenuButton'
import SearchButton from './Buttons/SearchButton'
import TabButton from './Buttons/TabButton'
import useBottomBarStyles from './useBottomTabBarStyles'

type BottomTabBarProps = {
  openMenu: () => void
  openHome: () => void
}

const BottomTabBar = ({ openMenu, openHome }: BottomTabBarProps) => {
  // const { style } = useBottomBarStyles()
  return (
    <AnimatedBox
      row
      pb={getBottomSpace()}
      bg="reverse"
      px={20}
      alignItems="center"
      justifyContent="space-around"
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      borderTopWidth={1}
      borderColor="border"
      // style={style}
    >
      <HomeButton openHome={openHome} />
      <SearchButton />
      <BibleButton />
      <TabButton />
      <MenuButton openMenu={openMenu} />
    </AnimatedBox>
  )
}

export default BottomTabBar
