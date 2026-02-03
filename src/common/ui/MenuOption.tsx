import React from 'react'
import { MenuOptionProps } from 'react-native-popup-menu'
import { LinearTransition } from 'react-native-reanimated'
import { usePopOver } from '../PopOverContext'
import { AnimatedTouchableBox } from './Box'

interface ExtendedMenuOptionProps extends Omit<MenuOptionProps, 'onSelect'> {
  closeOnSelect?: boolean
  onSelect?: (value?: any) => void
}

const MenuOption = ({ onSelect, closeOnSelect = true, ...props }: ExtendedMenuOptionProps) => {
  const { onClose } = usePopOver()

  const handleSelect = (value?: any) => {
    if (onSelect) {
      onSelect(value)
    }
    if (closeOnSelect) {
      onClose()
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
