import React from 'react'
import Link from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'

const RandomButton = ({ onPress }: { onPress: () => void }) => {
  return (
    <Link
      onPress={onPress}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FeatherIcon name="refresh-cw" size={15} color="white" />
    </Link>
  )
}

export default RandomButton
