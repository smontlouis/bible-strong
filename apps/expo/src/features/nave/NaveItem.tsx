import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { titleFontStyle } from '~themes/styleValues'
import { memo, useCallback } from 'react'
import { Pressable } from 'react-native'

import Link from '~common/Link'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

/** Height of a row, used by the list layout. */
export const NAVE_ITEM_HEIGHT = 60

interface NaveItemProps {
  name_lower: string
  name: string
  onSelect?: (name_lower: string, name: string) => void
  /** The hairline under the row; the last row of a group has none. */
  hasSeparator?: boolean
}

const NaveItem = memo(({ name_lower, name, onSelect, hasSeparator = true }: NaveItemProps) => {
  const stylingTheme = useStylingTheme()

  const pushRouteOnce = usePushRouteOnce()

  const handlePress = useCallback(() => {
    if (onSelect) {
      onSelect(name_lower, name)
    } else {
      pushRouteOnce({
        pathname: '/nave-detail',
        params: { name_lower, name },
      })
    }
  }, [onSelect, name_lower, name, pushRouteOnce])

  const content = (
    <Box className="px-[20px] items-start justify-center" style={{ height: NAVE_ITEM_HEIGHT }}>
      <Box className="flex-row">
        <Text
          className="text-[18px] text-default flex-[1] pr-[20px]"
          style={titleFontStyle(stylingTheme)}
        >
          {name}
        </Text>
      </Box>
      {hasSeparator && <Border className="absolute bottom-0 left-[20px] right-0" />}
    </Box>
  )

  // If onSelect is provided, use Pressable directly instead of Link
  if (onSelect) {
    return (
      <Pressable accessibilityRole="button" onPress={handlePress}>
        {content}
      </Pressable>
    )
  }

  // Otherwise use Link for standard navigation
  return (
    <Link route="NaveDetail" params={{ name_lower, name }}>
      {content}
    </Link>
  )
})

export default NaveItem
