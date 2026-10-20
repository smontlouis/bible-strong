import { twMerge } from '~common/ui/classNames'
import { colorWithOpacity, resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import type { ReactNode } from 'react'
import { Pressable } from 'react-native'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

type Props = {
  label: string
  description: string
  selected: boolean
  /** The mode's resources can be read neither online nor from an Offline copy. */
  unavailable?: boolean
  /** Why the mode is unavailable, shown under the description. */
  unavailableLabel?: string
  onPress: () => void
  /** A preview of the mode, on the card's tinted panel. */
  children: ReactNode
}

const BibleDisplayModeCard = ({
  label,
  description,
  selected,
  unavailable = false,
  unavailableLabel,
  onPress,
  children,
}: Props) => {
  const stylingTheme = useStylingTheme()
  // Half-transparent grounds: the sheet's blur shows through, as on the other sheets
  const translucent = (color: 'reverse' | 'lightGrey' | 'lightPrimary') =>
    colorWithOpacity(resolveThemeColor(stylingTheme, color), 0.5)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: unavailable }}
      accessibilityLabel={[label, description, unavailable ? unavailableLabel : undefined]
        .filter(Boolean)
        .join('. ')}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.72 : 1 })}
    >
      <Box
        className={twMerge(
          'overflow-hidden border-continuous rounded-[20px] p-[6px] pb-[12px] gap-[10px]',
          selected ? 'border-primary' : 'border-border'
        )}
        // Sized by its content, then stretched to the taller card of its row
        style={{
          flexGrow: 1,
          borderWidth: selected ? 2 : 1,
          backgroundColor: translucent('reverse'),
        }}
      >
        <Box
          className="h-[92px] items-center justify-center overflow-hidden border-continuous rounded-[15px]"
          style={{
            backgroundColor: translucent(selected ? 'lightPrimary' : 'lightGrey'),
            opacity: unavailable ? 0.45 : 1,
          }}
        >
          {children}
        </Box>
        {selected && (
          <Box className="absolute top-[14px] right-[14px] w-[22px] h-[22px] rounded-full bg-primary items-center justify-center">
            <FeatherIcon name="check" size={14} color="reverse" />
          </Box>
        )}
        <Box className="px-[8px] gap-[2px]">
          <Text
            className={twMerge(
              'font-bold text-[15px] leading-[20px]',
              selected ? 'text-primary' : unavailable ? 'text-grey' : 'text-default'
            )}
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text className="text-[12px] leading-[16px] text-tertiary" numberOfLines={1}>
            {description}
          </Text>
        </Box>
        {unavailable && unavailableLabel && (
          <Box className="flex-row items-center gap-[5px] px-[8px]">
            <FeatherIcon name="wifi-off" size={13} color="grey" />
            <Text className="text-[12px] leading-[16px] font-bold text-grey">
              {unavailableLabel}
            </Text>
          </Box>
        )}
      </Box>
    </Pressable>
  )
}

export default BibleDisplayModeCard
