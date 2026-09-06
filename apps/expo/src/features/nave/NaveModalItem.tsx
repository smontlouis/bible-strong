import { resolveThemeColor, resolveFontFamily, colorWithOpacity } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React from 'react'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
type NaveModalItemProps = {
  item: {
    name: string
    name_lower: string
  }
}

const NaveItem = ({ item: { name, name_lower } }: NaveModalItemProps) => {
  const stylingTheme = useStylingTheme()

  return (
    <Link route="NaveDetail" params={{ name, name_lower }}>
      <Box
        className="overflow-hidden border-continuous rounded-[5px] px-[12px] py-[5px]"
        style={{ backgroundColor: colorWithOpacity(resolveThemeColor(stylingTheme, 'quint'), 0.1) }}
      >
        <Text
          className="text-quint text-[14px]"
          style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
        >
          {name}
        </Text>
      </Box>
    </Link>
  )
}

export default NaveItem
