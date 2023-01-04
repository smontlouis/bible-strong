import React from 'react'
import {
  MenuOption as BaseMenuOption,
  MenuOptionProps,
} from 'react-native-popup-menu'

const MenuOption = (props: MenuOptionProps) => {
  return (
    <BaseMenuOption
      {...props}
      customStyles={{
        optionWrapper: {
          paddingHorizontal: 10,
        },
      }}
    />
  )
}

export default MenuOption
