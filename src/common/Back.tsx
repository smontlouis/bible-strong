import React, { memo } from 'react'
import { TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'

type BackProps = {
  padding?: boolean
  style?: any
  onCustomPress?: () => void
}

const Back = ({ padding, style, onCustomPress, ...props }: BackProps) => {
  const navigation = useNavigation()

  const handlePress = () => {
    navigation.goBack()
  }

  return (
    <TouchableOpacity
      {...props}
      onPress={onCustomPress || handlePress}
      style={{
        ...style,
        ...(padding && {
          width: 60,
          height: 60,
          alignItems: 'center',
          justifyContent: 'center',
        }),
      }}
    />
  )
}

export default memo(Back)
