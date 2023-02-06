import { useTheme } from '@emotion/react'
import React from 'react'
import { Switch as SwitchBase, SwitchProps } from 'react-native'

const Switch = (props: SwitchProps) => {
  const theme = useTheme()

  return (
    <SwitchBase
      //   ios_backgroundColor={theme.colors.opacity5}
      //   trackColor={{
      //     false: theme.colors.opacity5,
      //     true: theme.colors.lightPrimary,
      //   }}
      //   thumbColor={
      //     props.value ? theme.colors.primary : theme.colors.lightPrimary
      //   }
      {...props}
    />
  )
}

export default Switch
