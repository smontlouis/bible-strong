import { twMerge } from '~common/ui/classNames'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { Feather } from '@expo/vector-icons'
import { Pressable } from 'react-native'
import { FadeIn, FadeOut } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import Box, { FadingBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OfflineSetupFolderVisual } from '../offlineSetupPresentation'
import OfflineResourceFolderBounce from './OfflineResourceFolderBounce'
import OfflineResourceFolderItems from './OfflineResourceFolderItems'
type OfflineResourceFolderProps = {
  title: string
  subtitle: string
  width: number
  icon: React.ComponentProps<typeof Feather>['name']
  itemCount: number
  selected: boolean
  showChevron?: boolean
  colors: OfflineSetupFolderVisual['colors']
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
  const stylingTheme = useStylingTheme()

  const scale = width / 170
  const scaled = (value: number) => value * scale

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
      <OfflineResourceFolderBounce itemCount={itemCount} width={width}>
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

        <OfflineResourceFolderItems colors={colors} itemCount={itemCount} width={width} />

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
          className="overflow-hidden border-continuous absolute z-[20] items-center justify-center bg-[rgba(255,255,255,0.82)]"
          style={{
            top: scaled(46),
            left: scaled(14),
            borderRadius: scaled(11),
            ...(scaled(34) ? { width: scaled(34), height: scaled(34) } : {}),
          }}
        >
          <Feather name={icon} size={scaled(20)} color={colors.icon} />
        </Box>

        <FadingBox
          className={twMerge(
            'overflow-hidden border-continuous',
            twMerge(
              selected ? 'bg-[#FFFFFF]' : 'bg-[rgba(255,255,255,0.18)]',
              'overflow-hidden absolute border-[rgba(255,255,255,0.9)] z-[20] items-center justify-center'
            )
          )}
          keyProp={selected ? 'selected' : 'unselected'}
          entering={FadeIn.duration(140)}
          exiting={FadeOut.duration(140)}
          skipEntering={false}
          skipExiting={false}
          style={{
            top: scaled(70),
            right: scaled(12),
            borderRadius: scaled(10),
            borderWidth: scaled(1.5),
            ...(scaled(20) ? { width: scaled(20), height: scaled(20) } : {}),
          }}
        >
          {selected ? <Feather name="check" size={scaled(13)} color={colors.icon} /> : null}
        </FadingBox>

        <Box
          className="overflow-hidden border-continuous absolute z-[20]"
          style={{ bottom: scaled(8), left: scaled(14), right: scaled(14) }}
        >
          <Box className="overflow-hidden border-continuous" style={{ paddingRight: scaled(30) }}>
            <Text
              className="text-[#FFFFFF]"
              numberOfLines={2}
              style={{
                fontSize: scaled(15) || 16,
                lineHeight: scaled(18),
                fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
              }}
            >
              {title}
            </Text>
          </Box>
          <Box
            className="overflow-hidden border-continuous flex-row items-center justify-between"
            style={{ marginTop: scaled(1) }}
          >
            <FadingBox
              className="overflow-hidden border-continuous"
              keyProp={subtitle}
              entering={FadeIn.duration(140)}
              exiting={FadeOut.duration(140)}
              skipEntering={false}
              skipExiting={false}
            >
              <Text
                className="text-[#FFFFFF]"
                style={{ fontSize: scaled(12) || 16, lineHeight: scaled(16) }}
              >
                {subtitle}
              </Text>
            </FadingBox>
            <Box
              className="overflow-hidden border-continuous items-center justify-center"
              style={{ ...(scaled(20) ? { width: scaled(20), height: scaled(20) } : {}) }}
            >
              {showChevron ? (
                <Feather name="chevron-right" size={scaled(20)} color="#FFFFFF" />
              ) : null}
            </Box>
          </Box>
        </Box>
      </OfflineResourceFolderBounce>
    </Pressable>
  )
}

export default OfflineResourceFolder
