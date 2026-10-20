import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { Pressable } from 'react-native'

import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

/** Height of a row, used by the list layout. */
export const DICTIONNAIRE_ITEM_HEIGHT = 60

interface DictionnaireItemProps {
  word: string
  onSelect: () => void
  /** The hairline under the row; the last row of a group has none. */
  hasSeparator?: boolean
}

const DictionnaireItem = ({ word, onSelect, hasSeparator = true }: DictionnaireItemProps) => {
  const stylingTheme = useStylingTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={word}
      onPress={onSelect}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <Box
        className="px-[20px] items-start justify-center"
        style={{ height: DICTIONNAIRE_ITEM_HEIGHT }}
      >
        <Box className="flex-row">
          <Text
            className="text-[18px] text-default flex-[1] pr-[20px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {word}
          </Text>
        </Box>
        {hasSeparator && <Border className="absolute bottom-0 left-[20px] right-0" />}
      </Box>
    </Pressable>
  )
}

export default DictionnaireItem
