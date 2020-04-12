import React from 'react'
import { useTheme } from 'emotion-theming'
import {
  Menu,
  MenuOptions,
  MenuTrigger,
  renderers,
} from 'react-native-popup-menu'

import Box from '~common/ui/Box'
import { Theme } from '~themes'

const { Popover } = renderers

interface Props {
  element: React.ReactNode
  popover: React.ReactNode
}

const PopOverMenu = ({ element, popover, ...props }: Props) => {
  const theme: Theme = useTheme()
  return (
    <Menu renderer={Popover} rendererProps={{ placement: 'bottom' }} {...props}>
      <MenuTrigger>{element}</MenuTrigger>
      <MenuOptions
        optionsContainerStyle={{
          backgroundColor: theme.colors.reverse,
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          borderRadius: 8,
        }}
      >
        <Box padding={10}>{popover}</Box>
      </MenuOptions>
    </Menu>
  )
}

export default PopOverMenu
