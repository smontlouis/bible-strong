import React from 'react'
import Box from '~common/ui/Box'
import Card from '~common/ui/Card'
import { ListSectionTitle } from '~common/ui/ListSection'
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
    <Box className="overflow-hidden border-continuous">
      <ListSectionTitle>{label}</ListSectionTitle>
      <Card className="px-[14px] py-[13px] flex-row flex-wrap gap-[6px]">
        {items.map(item => (
          <NaveModalItem
            key={item.normalizedName}
            item={{ name: item.name, name_lower: item.normalizedName }}
          />
        ))}
      </Card>
    </Box>
  )
}

export default NaveModalForVerse
