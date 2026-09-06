import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { TouchableOpacity } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import Text from '~common/ui/Text'

interface StyledChipProps {
  isSelected?: boolean
}

const StyledChip = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, keyof StyledChipProps | 'theme'> &
    Omit<StyledChipProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isSelected } = props
  const classStyles = useResolveClassNames(
    twMerge('rounded-[20px] pt-[5px] pb-[5px] pl-[12px] pr-[12px] mr-[5px] mb-[5px]', className)
  )
  return (
    <NativeUI.View
      {...props}
      style={
        [
          classStyles,
          {
            backgroundColor: isSelected ? theme.colors.primary : theme.colors.lightPrimary,
            ...(isSelected && {
              shadowColor: theme.colors.default,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 2,
              elevation: 1,
            }),
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.View>['style']
      }
    />
  )
}

interface StyledTextProps {
  isSelected?: boolean
}

const StyledText = (
  componentProps: Omit<UIComponentProps<typeof Text>, keyof StyledTextProps | 'theme'> &
    Omit<StyledTextProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { isSelected } = props
  const classStyles = useResolveClassNames(twMerge('', className))
  return (
    <Text
      {...props}
      style={
        [classStyles, { color: isSelected ? 'white' : 'black' }, props.style] as UIComponentProps<
          typeof Text
        >['style']
      }
    />
  )
}

interface ChipProps {
  label: string
  isSelected?: boolean
  onPress?: () => void
}

const Chip = ({ label, isSelected, onPress }: ChipProps) => (
  <TouchableOpacity
    accessibilityLabel={label}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityState={onPress ? { selected: Boolean(isSelected) } : undefined}
    accessible={Boolean(onPress)}
    disabled={!onPress}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <StyledChip isSelected={isSelected}>
      <StyledText isSelected={isSelected}>{label}</StyledText>
    </StyledChip>
  </TouchableOpacity>
)

export default Chip
