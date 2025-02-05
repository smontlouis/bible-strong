import React from 'react'
import {
  MenuOption as BaseMenuOption,
  MenuOptionProps,
} from 'react-native-popup-menu'
import { usePopOver } from '../PopOverContext'
import Box, { TouchableBox } from './Box'

interface ExtendedMenuOptionProps extends Omit<MenuOptionProps, 'onSelect'> {
  closeOnSelect?: boolean
  onSelect?: (value?: any) => void
}

const MenuOption = ({
  onSelect,
  closeOnSelect = true,
  ...props
}: ExtendedMenuOptionProps) => {
  const { onClose } = usePopOver()

  const handleSelect = (value?: any) => {
    if (onSelect) {
      onSelect(value)
    }
    if (closeOnSelect) {
      onClose()
    }
  }

  return <TouchableBox {...props} onPress={handleSelect} py={8} px={15} />
}

export default MenuOption
