import React from 'react'
import { useTheme } from '@emotion/react'
import {
  Menu,
  MenuOptions,
  MenuTrigger,
  renderers,
} from 'react-native-popup-menu'

import Box from '~common/ui/Box'
import { Theme } from '~themes'
import { FeatherIcon } from './ui/Icon'

const { Popover } = renderers

interface Props {
  element?: React.ReactNode
  popover: React.ReactNode
  width?: number
  height?: number
}

const PopOverMenu = ({
  element,
  popover,
  width = 60,
  height = 60,
  ...props
}: Props) => {
  const theme: Theme = useTheme()
  return (
    <Menu
      renderer={Popover}
      rendererProps={{
        placement: 'bottom',
        anchorStyle: { backgroundColor: theme.colors.reverse },
      }}
      {...props}
    >
      <MenuTrigger
        customStyles={{
          triggerTouchable: {
            borderRadius: 25,
            activeOpacity: 0.5,
            underlayColor: 'transparent',
          },
        }}
      >
        {element || (
          <Box row center height={height} width={width}>
            <FeatherIcon name="more-vertical" size={18} />
          </Box>
        )}
      </MenuTrigger>
      <MenuOptions
        customStyles={{
          optionsContainer: {
            backgroundColor: theme.colors.reverse,
            shadowColor: 'rgb(89,131,240)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 7,
            elevation: 1,
            borderRadius: 8,
          },
        }}
      >
        <Box paddingVertical={10}>{popover}</Box>
      </MenuOptions>
    </Menu>
  )
}

export default PopOverMenu
