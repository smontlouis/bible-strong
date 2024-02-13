import remoteConfig from '@react-native-firebase/remote-config'
import React from 'react'
import { RemoteConfigValue } from '~common/types'
import { useIsPremium } from '~helpers/usePremium'
import Box, { BoxProps } from './Box'
import { IonIcon } from './Icon'

export interface EarlyAccessIconProps {
  value: RemoteConfigValue
  size?: number
  inline?: boolean
}

const EarlyAccessIcon = ({
  value,
  size = 20,
  inline,
  ...props
}: EarlyAccessIconProps & BoxProps) => {
  const enable = remoteConfig().getValue(value)
  const hasPremium = useIsPremium()

  if (hasPremium || enable.asBoolean()) {
    return null
  }

  return (
    <Box
      {...(!inline && {
        position: 'absolute',
        top: 0,
        right: -2,
      })}
      {...props}
    >
      <IonIcon name="time" size={size} color="primary" />
    </Box>
  )
}

export default EarlyAccessIcon
