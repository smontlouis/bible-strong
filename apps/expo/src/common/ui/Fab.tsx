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
      className="overflow-hidden border-continuous w-[50px] h-[50px] rounded-[30px] bg-primary items-center justify-center"
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
    >
      <FeatherIcon name={icon} size={18} color="white" />
    </TouchableBox>
  )
}

export default Fab
