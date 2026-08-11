import { Feather } from '@expo/vector-icons'
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef } from 'react'
import { Pressable } from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'

import Box, { FadingBox } from '~common/ui/Box'
import Text from '~common/ui/Text'

type OfflineResourceFolderProps = {
  title: string
  subtitle: string
  width: number
  icon: React.ComponentProps<typeof Feather>['name']
  itemCount: number
  selected: boolean
  showChevron?: boolean
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
  width,
  icon,
  itemCount,
  selected,
  showChevron = true,
  colors,
  onPress,
}: OfflineResourceFolderProps) => {
  const scale = width / 170
  const scaled = (value: number) => value * scale
  const bounceDistance = scaled(2.5)
  const visibleItemCount = Math.max(0, Math.floor(itemCount))
  const maxFanSpread = scaled(120)
  const regularCardGap = maxFanSpread / 7
  const cardGap = visibleItemCount > 8 ? maxFanSpread / (visibleItemCount - 1) : regularCardGap
  const reduceMotion = useReducedMotion()
  const bounceProgress = useSharedValue(0)
  const previousItemCount = useRef(itemCount)

  useEffect(() => {
    if (previousItemCount.current === itemCount) return
    previousItemCount.current = itemCount
    if (reduceMotion) return

    bounceProgress.set(
      withSequence(
        withTiming(1, { duration: 90 }),
        withSpring(0, { damping: 14, stiffness: 220, mass: 0.55 })
      )
    )
  }, [bounceProgress, itemCount, reduceMotion])

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -bounceDistance * bounceProgress.get() },
      { scale: 1 + 0.012 * bounceProgress.get() },
    ],
  }))

  return (
    <Pressable
      accessible={Boolean(onPress)}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      accessibilityLabel={`${title}, ${subtitle}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        width,
        aspectRatio: 170 / 154,
        overflow: 'visible',
        opacity: pressed && onPress ? 0.88 : 1,
        transform: [{ scale: pressed && onPress ? 0.98 : 1 }],
      })}
    >
      <Animated.View style={[{ position: 'absolute', inset: 0, overflow: 'visible' }, bounceStyle]}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 170 154"
          fill="none"
          style={{ position: 'absolute', zIndex: 0 }}
        >
          <Path
            d="M20 0H150C161 0 170 9 170 20V134C170 145 161 154 150 154H20C9 154 0 145 0 134V20C0 9 9 0 20 0Z"
            fill={colors.back}
          />
          <Path
            d="M42 12H142C153 12 162 21 162 32V112C162 123 153 132 142 132H30C20 132 12 123 12 112V32C12 21 20 12 30 12H42Z"
            fill="#FFFDF8"
          />
        </Svg>

        {Array.from({ length: visibleItemCount }, (_, index) => {
          const centeredIndex = index - (visibleItemCount - 1) / 2
          const translateX = centeredIndex * cardGap
          const fanProgress = visibleItemCount > 1 ? translateX / (maxFanSpread / 2) : 0
          const translateY = scaled(14 + Math.abs(fanProgress) * 3)
          const rotation = fanProgress * 10

          return (
            <Animated.View
              key={`folder-file-${index}`}
              entering={
                reduceMotion
                  ? undefined
                  : FadeInDown.springify()
                      .damping(15)
                      .stiffness(190)
                      .mass(0.55)
                      .delay(Math.min(index, 7) * 24)
              }
              exiting={reduceMotion ? undefined : FadeOutDown.duration(130)}
              style={{
                position: 'absolute',
                left: scaled(62.5),
                top: 5,
                zIndex: 1,
              }}
            >
              <Animated.View
                style={{
                  width: scaled(45),
                  height: scaled(50),
                  borderRadius: scaled(7),
                  overflow: 'hidden',
                  borderWidth: scaled(0.7),
                  borderColor: 'rgba(255,255,255,0.86)',
                  boxShadow: `0 ${scaled(3)}px ${scaled(8)}px rgba(31,49,79,0.2)`,
                  transform: [{ translateX }, { translateY }, { rotate: `${rotation}deg` }],
                  transitionProperty: 'transform',
                  transitionDuration: 240,
                  transitionTimingFunction: 'ease-out',
                }}
              >
                <ExpoLinearGradient
                  colors={['rgba(255,255,255,0.98)', colors.back]}
                  start={{ x: 0.15, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={{ flex: 1, padding: scaled(7) }}
                >
                  <Box
                    width={scaled(14)}
                    height={scaled(2.5)}
                    borderRadius={scaled(1.25)}
                    bg={colors.frontEnd}
                    opacity={0.72}
                  />
                  <Box
                    width={scaled(9)}
                    height={scaled(2.5)}
                    borderRadius={scaled(1.25)}
                    bg={colors.frontEnd}
                    opacity={0.38}
                    mt={scaled(3)}
                  />
                </ExpoLinearGradient>
              </Animated.View>
            </Animated.View>
          )
        })}

        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 170 154"
          fill="none"
          style={{ position: 'absolute', zIndex: 10 }}
        >
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
            d="M0 54C0 43 9 34 20 34H75C90 34 95.5 34 104 50C108 57 114 60 122 60H150C161 60 170 69 170 80V134C170 145 161 154 150 154H20C9 154 0 145 0 134V54Z"
            fill={`url(#folder-front-${icon})`}
          />
        </Svg>

        <Box
          position="absolute"
          top={scaled(46)}
          left={scaled(14)}
          size={scaled(34)}
          borderRadius={scaled(11)}
          zIndex={20}
          center
          bg="rgba(255,255,255,0.82)"
        >
          <Feather name={icon} size={scaled(20)} color={colors.icon} />
        </Box>

        <FadingBox
          keyProp={selected ? 'selected' : 'unselected'}
          entering={FadeIn.duration(140)}
          exiting={FadeOut.duration(140)}
          skipEntering={false}
          skipExiting={false}
          position="absolute"
          top={scaled(70)}
          right={scaled(12)}
          size={scaled(20)}
          borderRadius={scaled(10)}
          borderWidth={scaled(1.5)}
          borderColor="rgba(255,255,255,0.9)"
          bg={selected ? '#FFFFFF' : 'rgba(255,255,255,0.18)'}
          zIndex={20}
          center
        >
          {selected ? <Feather name="check" size={scaled(13)} color={colors.icon} /> : null}
        </FadingBox>

        <Box
          position="absolute"
          left={scaled(14)}
          right={scaled(14)}
          bottom={scaled(8)}
          zIndex={20}
        >
          <Box pr={scaled(30)}>
            <Text
              color="#FFFFFF"
              title
              fontSize={scaled(15)}
              lineHeight={scaled(18)}
              numberOfLines={2}
            >
              {title}
            </Text>
          </Box>
          <Box row alignItems="center" justifyContent="space-between" mt={scaled(1)}>
            <FadingBox
              keyProp={subtitle}
              entering={FadeIn.duration(140)}
              exiting={FadeOut.duration(140)}
              skipEntering={false}
              skipExiting={false}
            >
              <Text color="#FFFFFF" fontSize={scaled(12)} lineHeight={scaled(16)}>
                {subtitle}
              </Text>
            </FadingBox>
            <Box size={scaled(20)} center>
              {showChevron ? (
                <Feather name="chevron-right" size={scaled(20)} color="#FFFFFF" />
              ) : null}
            </Box>
          </Box>
        </Box>
      </Animated.View>
    </Pressable>
  )
}

export default OfflineResourceFolder
