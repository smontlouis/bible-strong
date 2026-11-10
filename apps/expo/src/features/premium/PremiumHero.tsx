import * as Haptics from 'expo-haptics'
import { Platform, Pressable } from 'react-native'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import StrobiAvatar, { type StrobiAnimation } from '~features/study-assistant/StrobiAvatar'
import { resolveThemeColor } from '~themes/colorValues'
import { titleFontStyle } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'

const HALO_SIZE = 220
const AVATAR_SIZE = 140

/**
 * The head of the Premium pages: Strobi on a soft halo of the theme's accent, the title and a
 * line under it. Strobi is blue: the halo stays pale so that he keeps his contrast on it.
 * Touching him makes him react (`onPet`), with a light tap of the haptic engine.
 */
const PremiumHero = ({
  animation,
  title,
  pitch,
  onPet,
}: {
  animation: StrobiAnimation
  title: string
  pitch: string
  onPet?: () => void
}) => {
  const theme = useTheme()
  const accent = resolveThemeColor(theme, 'primary')
  return (
    <Box className="items-center px-[24px] mb-[22px]">
      <Pressable
        accessible={false}
        onPress={() => {
          if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onPet?.()
        }}
        style={{
          width: HALO_SIZE,
          height: HALO_SIZE - 50,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg
          width={HALO_SIZE}
          height={HALO_SIZE}
          style={{ position: 'absolute', top: -25 }}
          pointerEvents="none"
        >
          <Defs>
            <RadialGradient id="premium-halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={accent} stopOpacity={0.26} />
              <Stop offset="0.55" stopColor={accent} stopOpacity={0.1} />
              <Stop offset="1" stopColor={accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={HALO_SIZE / 2}
            cy={HALO_SIZE / 2}
            r={HALO_SIZE / 2}
            fill="url(#premium-halo)"
          />
        </Svg>
        <StrobiAvatar animation={animation} size={AVATAR_SIZE} settleAfterMs={8000} />
      </Pressable>
      <Text
        accessibilityRole="header"
        className="text-[28px] text-center"
        style={titleFontStyle(theme)}
      >
        {title}
      </Text>
      <Text className="text-[16px] leading-[23px] text-center mt-[8px]">{pitch}</Text>
    </Box>
  )
}

export default PremiumHero
