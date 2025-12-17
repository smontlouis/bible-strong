import React from 'react'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import NaveModalItem from './NaveModalItem'

const NaveModalForVerse = ({ items, label }: any) => {
  if (!items) {
    return null
  }

  return (
    <Box>
      <Text title fontSize={14} color="grey">
        {label}
      </Text>
      <Box row wrap marginTop={5} marginBottom={20}>
        {items.map((item: any, i: number) => (
          <NaveModalItem key={i} item={item} />
        ))}
      </Box>
    </Box>
  )
}

export default NaveModalForVerse
