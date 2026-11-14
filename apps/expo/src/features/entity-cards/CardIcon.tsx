// surface-allow: a collectible card is a drawn object with its own edge, radius and shadow (ADR-0090)
import { View } from 'react-native'

import { useTheme } from '~themes/ThemeProvider'

export const CARD_ICON_WIDTH = 22
export const CARD_ICON_HEIGHT = 30

/**
 * A character's card in its header (ADR-0090): a small card, grey and empty until the reader
 * collects it, then gold like the dot that announced it.
 */
export const CardIcon = ({ collected }: { collected: boolean }) => {
  const theme = useTheme()
  const ink = collected ? '#b9851c' : theme.colors.grey
  return (
    <View
      style={{
        width: CARD_ICON_WIDTH,
        height: CARD_ICON_HEIGHT,
        borderRadius: 4,
        borderCurve: 'continuous',
        borderWidth: 1.5,
        borderColor: ink,
        padding: 2.5,
        opacity: collected ? 1 : 0.45,
        transform: [{ rotate: '-8deg' }],
        // The gold under the gradient, for the Web, which draws no background image here.
        backgroundColor: collected ? '#f2c14e' : undefined,
        experimental_backgroundImage: collected
          ? 'linear-gradient(135deg, #fff1b8 0%, #f2c14e 45%, #d39a1f 100%)'
          : undefined,
        boxShadow: collected ? '0 1px 4px rgba(185, 133, 28, 0.45)' : undefined,
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: 2,
          borderWidth: 1,
          borderColor: collected ? 'rgba(255, 255, 255, 0.75)' : ink,
        }}
      />
    </View>
  )
}
