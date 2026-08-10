import { Feather } from '@expo/vector-icons'
import { Pressable } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

type OfflineResourceFolderProps = {
  title: string
  subtitle: string
  icon: React.ComponentProps<typeof Feather>['name']
  selected: boolean
  colors: {
    back: string
    frontStart: string
    frontEnd: string
    icon: string
  }
  onPress?: () => void
}

const OfflineResourceFolder = ({
  title,
  subtitle,
  icon,
  selected,
  colors,
  onPress,
}: OfflineResourceFolderProps) => (
  <Pressable
    accessible={Boolean(onPress)}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityState={onPress ? { selected } : undefined}
    accessibilityLabel={`${title}, ${subtitle}`}
    disabled={!onPress}
    onPress={onPress}
    style={({ pressed }) => ({
      flex: 1,
      aspectRatio: 170 / 154,
      opacity: pressed && onPress ? 0.88 : 1,
      transform: [{ scale: pressed && onPress ? 0.98 : 1 }],
    })}
  >
    <Box absoluteFill>
      <Svg width="100%" height="100%" viewBox="0 0 170 154" fill="none">
        <Defs>
          <LinearGradient
            id={`folder-front-${icon}`}
            x1="133.754"
            y1="44.851"
            x2="36.246"
            y2="143.149"
            gradientUnits="userSpaceOnUse"
          >
            <Stop stopColor={colors.frontStart} />
            <Stop offset="1" stopColor={colors.frontEnd} />
          </LinearGradient>
        </Defs>
        <Path
          d="M20 0H150C161 0 170 9 170 20V134C170 145 161 154 150 154H20C9 154 0 145 0 134V20C0 9 9 0 20 0Z"
          fill={colors.back}
        />
        <Path
          d="M42 12H142C153 12 162 21 162 32V112C162 123 153 132 142 132H30C20 132 12 123 12 112V32C12 21 20 12 30 12H42Z"
          fill="#FFFDF8"
        />
        <Path
          d="M0 54C0 43 9 34 20 34H75C90 34 95.5 34 104 50C108 57 114 60 122 60H150C161 60 170 69 170 80V134C170 145 161 154 150 154H20C9 154 0 145 0 134V54Z"
          fill={`url(#folder-front-${icon})`}
        />
      </Svg>

      <Box
        position="absolute"
        top={56}
        left={20}
        size={34}
        borderRadius={11}
        center
        bg="rgba(255,255,255,0.82)"
      >
        <Feather name={icon} size={20} color={colors.icon} />
      </Box>

      <Box
        position="absolute"
        top={70}
        right={18}
        size={20}
        borderRadius={10}
        borderWidth={1.5}
        borderColor="rgba(255,255,255,0.9)"
        bg={selected ? '#FFFFFF' : 'rgba(255,255,255,0.18)'}
        center
      >
        {selected ? <Feather name="check" size={13} color={colors.icon} /> : null}
      </Box>

      <Box position="absolute" left={20} right={16} bottom={13}>
        <Text color="#FFFFFF" title fontSize={15} lineHeight={18} numberOfLines={2}>
          {title}
        </Text>
        <Box row alignItems="center" justifyContent="space-between" mt={1}>
          <Text color="#FFFFFF" fontSize={12} lineHeight={16}>
            {subtitle}
          </Text>
          <Feather name="chevron-right" size={20} color="#FFFFFF" />
        </Box>
      </Box>
    </Box>
  </Pressable>
)

export default OfflineResourceFolder
