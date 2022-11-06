import React from 'react'

import Box from '~common/ui/Box'
import Link from '~common/Link'
import { useDispatch, useSelector } from 'react-redux'
import { setSettingsTheme } from '~redux/modules/user/settings'
import styled from '~styled'
import { Theme } from '~themes'
import { RootState } from '~redux/modules/reducer'

const LinkBox = Box.withComponent(Link)

export const Circle = styled.View(
  ({
    isSelected,
    color,
    size,
    theme,
  }: {
    isSelected: boolean
    color: string
    size: number
    theme: Theme
  }) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    borderWidth: 2,
    borderColor: isSelected ? theme.colors.primary : theme.colors.opacity5,
    marginLeft: 10,
  })
)

const SwitchTheme = () => {
  const dispatch = useDispatch()
  const currentTheme = useSelector(
    (state: RootState) => state.user.bible.settings.theme
  )
  return (
    <Box center row>
      <LinkBox onPress={() => dispatch(setSettingsTheme('default'))}>
        <Circle
          isSelected={currentTheme === 'default'}
          size={30}
          color="rgb(255,255,255)"
        />
      </LinkBox>
      <LinkBox onPress={() => dispatch(setSettingsTheme('sepia'))}>
        <Circle
          isSelected={currentTheme === 'sepia'}
          size={30}
          color="rgb(245,242,227)"
        />
      </LinkBox>
      <LinkBox onPress={() => dispatch(setSettingsTheme('dark'))}>
        <Circle
          isSelected={currentTheme === 'dark'}
          size={30}
          color="rgb(18,45,66)"
        />
      </LinkBox>
      <LinkBox onPress={() => dispatch(setSettingsTheme('black'))}>
        <Circle isSelected={currentTheme === 'black'} size={30} color="black" />
      </LinkBox>
    </Box>
  )
}

export default SwitchTheme
