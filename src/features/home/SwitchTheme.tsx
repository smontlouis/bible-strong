import React from 'react'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Link from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import { setSettingsTheme } from '~redux/modules/user/settings'

const LinkBox = Box.withComponent(Link)

const SwitchTheme = () => {
  const theme = useSelector(
    (state: RootState) => state.user.bible.settings.theme
  )
  const dispatch = useDispatch()
  return (
    <Box row>
      <LinkBox
        row
        flex
        center
        onPress={() => dispatch(setSettingsTheme('default'))}
      >
        <FeatherIcon
          name="sun"
          size={18}
          color={theme === 'default' ? 'primary' : 'default'}
        />
        <Text
          marginLeft={10}
          color={theme === 'default' ? 'primary' : 'default'}
        >
          Jour
        </Text>
      </LinkBox>
      <LinkBox
        row
        flex
        center
        onPress={() => dispatch(setSettingsTheme('dark'))}
      >
        <FeatherIcon
          color={theme === 'dark' ? 'primary' : 'default'}
          name="moon"
          size={18}
        />
        <Text color={theme === 'dark' ? 'primary' : 'default'} marginLeft={10}>
          Nuit bleutée
        </Text>
      </LinkBox>
      <LinkBox
        row
        flex
        center
        onPress={() => dispatch(setSettingsTheme('black'))}
      >
        <FeatherIcon
          color={theme === 'black' ? 'primary' : 'default'}
          name="circle"
          size={18}
        />
        <Text color={theme === 'black' ? 'primary' : 'default'} marginLeft={10}>
          Noir
        </Text>
      </LinkBox>
    </Box>
  )
}

export default SwitchTheme
