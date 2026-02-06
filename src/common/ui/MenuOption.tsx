import React from 'react'
import { MenuOptionProps } from 'react-native-popup-menu'
import { LinearTransition } from 'react-native-reanimated'
import { usePopOver } from '../PopOverContext'
import { AnimatedTouchableBox } from './Box'

interface ExtendedMenuOptionProps extends Omit<MenuOptionProps, 'onSelect'> {
  closeOnSelect?: boolean
  closeBeforeSelect?: boolean
  onSelect?: (value?: any) => void
}

const MenuOption = ({
  onSelect,
  closeOnSelect = true,
  closeBeforeSelect = false,
  ...props
}: ExtendedMenuOptionProps) => {
  const { onClose, closeAndWait } = usePopOver()

  const handleSelect = async (value?: any) => {
    if (closeBeforeSelect) {
      await closeAndWait()
      onSelect?.(value)
    } else {
      onSelect?.(value)
      if (closeOnSelect) {
        onClose()
      }
    }
  }

  return (
    <AnimatedTouchableBox
      layout={LinearTransition}
      {...props}
      onPress={handleSelect}
      py={8}
      px={15}
    />
  )
}

export default MenuOption
