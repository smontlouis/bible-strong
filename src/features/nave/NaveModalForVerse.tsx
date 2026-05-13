import React from 'react'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import NaveModalItem from './NaveModalItem'

interface NaveModalVerseItem {
  name: string
  name_lower: string
}

interface NaveModalForVerseProps {
  items?: NaveModalVerseItem[]
  label: string
}

const NaveModalForVerse = ({ items, label }: NaveModalForVerseProps) => {
  if (!items) {
    return null
  }

  return (
    <Box>
      <Text title fontSize={14} color="grey">
        {label}
      </Text>
      <Box row wrap marginTop={5} marginBottom={20}>
        {items.map(item => (
          <NaveModalItem key={item.name_lower} item={item} />
        ))}
      </Box>
    </Box>
  )
}

export default NaveModalForVerse
