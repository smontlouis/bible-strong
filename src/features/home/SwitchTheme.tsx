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
    <LinkBox
      row
      onPress={() =>
        dispatch(setSettingsTheme(theme === 'dark' ? 'default' : 'dark'))
      }
    >
      <Box row flex center>
        <FeatherIcon
          name="sun"
          size={20}
          color={theme === 'default' ? 'primary' : 'default'}
        />
        <Text
          marginLeft={15}
          color={theme === 'default' ? 'primary' : 'default'}
        >
          Jour
        </Text>
      </Box>
      <Box row flex center>
        <FeatherIcon
          color={theme === 'dark' ? 'primary' : 'default'}
          name="moon"
          size={20}
        />
        <Text color={theme === 'dark' ? 'primary' : 'default'} marginLeft={15}>
          Nuit
        </Text>
      </Box>
    </LinkBox>
  )
}

export default SwitchTheme
