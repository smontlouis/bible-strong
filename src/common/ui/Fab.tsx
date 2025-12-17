import React from 'react'

import { TouchableBox } from './Box'
import { FeatherIcon } from './Icon'

const Fab = ({ icon, onPress }: { onPress: () => void; icon: any }) => {
  return (
    <TouchableBox onPress={onPress} w={60} h={60} borderRadius={30} bg="primary" center>
      <FeatherIcon name={icon} size={22} color="white" />
    </TouchableBox>
  )
}

export default Fab
