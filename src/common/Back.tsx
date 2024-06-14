import React, { FC, memo, PropsWithChildren } from 'react'
import { TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { MainStackProps } from '~navigation/type'
import { StackNavigationProp } from '@react-navigation/stack'

type BackProps = {
  padding?: boolean
  style?: any
  onCustomPress?: () => void
}

const Back: FC<PropsWithChildren<BackProps>> = ({ padding, style, onCustomPress, ...props }: BackProps) => {
  const navigation = useNavigation<StackNavigationProp<MainStackProps>>()

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
