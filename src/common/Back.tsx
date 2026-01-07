import { useRouter } from 'expo-router'
import React, { FC, PropsWithChildren } from 'react'
import { TouchableOpacity } from 'react-native'

type BackProps = {
  padding?: boolean
  style?: any
  onCustomPress?: () => void
  onGoBack?: () => void
}

const Back: FC<PropsWithChildren<BackProps>> = ({
  padding,
  style,
  onCustomPress,
  onGoBack,
  ...props
}: BackProps) => {
  const router = useRouter()

  const handlePress = () => {
    router.back()
    onGoBack?.()
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

export default Back
