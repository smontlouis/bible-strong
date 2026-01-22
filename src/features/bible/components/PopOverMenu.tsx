import { useTheme } from '@emotion/react'
import { Menu, MenuOptions, MenuTrigger, renderers } from 'react-native-popup-menu'
import Box from '~common/ui/Box'

const { Popover } = renderers

interface PopOverMenuProps {
  element: React.ReactNode
  popover: React.ReactNode
  disabled?: boolean
}

export function PopOverMenu({ element, popover, disabled, ...props }: PopOverMenuProps) {
  const theme = useTheme()

  if (disabled) {
    return <>{element}</>
  }

  return (
    <Menu
      renderer={Popover}
      rendererProps={{ placement: 'top', anchorStyle: { opacity: 0 } }}
      {...props}
    >
      <MenuTrigger>{element}</MenuTrigger>
      <MenuOptions
        optionsContainerStyle={{
          backgroundColor: theme.colors.reverse,
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 5,
          borderRadius: 12,
        }}
      >
        <Box padding={15}>{popover}</Box>
      </MenuOptions>
    </Menu>
  )
}
