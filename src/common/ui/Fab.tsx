import React from 'react'

import { TouchableBox } from './Box'
import { FeatherIcon } from './Icon'

const Fab = ({ icon, onPress }: { onPress: () => void; icon: any }) => {
  return (
    <TouchableBox onPress={onPress} w={50} h={50} borderRadius={30} bg="primary" center>
      <FeatherIcon name={icon} size={18} color="white" />
    </TouchableBox>
  )
}

export default Fab
