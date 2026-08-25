import React from 'react'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import NaveModalItem from './NaveModalItem'
import type { NaveTopicReference } from '~features/resources/naveAccess'

interface NaveModalForVerseProps {
  items?: NaveTopicReference[]
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
          <NaveModalItem
            key={item.normalizedName}
            item={{ name: item.name, name_lower: item.normalizedName }}
          />
        ))}
      </Box>
    </Box>
  )
}

export default NaveModalForVerse
