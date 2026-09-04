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
  if (!items?.length) {
    return null
  }

  return (
    <Box px={14} py={13} rounded bg="reverse" lightShadow>
      <Text title fontSize={14} color="grey">
        {label}
      </Text>
      <Box row wrap gap={5} mt={5}>
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
