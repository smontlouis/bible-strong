import React from 'react'
import {
  MenuOptionsProps,
  MenuOption as BaseMenuOption,
} from 'react-native-popup-menu'

const MenuOption = (props: MenuOptionsProps) => {
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
