import React from 'react'

import { TouchableBox } from './Box'
import { FeatherIcon } from './Icon'

type FeatherIconName = React.ComponentProps<typeof FeatherIcon>['name']

const Fab = ({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string
  onPress: () => void
  icon: FeatherIconName
}) => {
  return (
    <TouchableBox
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      w={50}
      h={50}
      borderRadius={30}
      bg="primary"
      center
    >
      <FeatherIcon name={icon} size={18} color="white" />
    </TouchableBox>
  )
}

export default Fab
