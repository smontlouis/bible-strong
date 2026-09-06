import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
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
  const stylingTheme = useStylingTheme()

  if (!items?.length) {
    return null
  }

  return (
    <Box
      className="overflow-hidden border-continuous px-[14px] py-[13px] rounded-[20px] bg-reverse"
      style={{
        shadowColor: 'rgb(89,131,240)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 7,
        elevation: 1,
        overflow: 'visible',
      }}
    >
      <Text
        className="text-[14px] text-grey"
        style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
      >
        {label}
      </Text>
      <Box className="overflow-hidden border-continuous flex-row flex-wrap gap-[5px] mt-[5px]">
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
