import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { Pressable } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

interface DictionnaireItemProps {
  word: string
  onSelect: () => void
}

const SectionItem = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge(
      'h-[60px] ml-[20px] mr-[20px] bg-reverse border-b-border border-b-[1px] items-start justify-center',
      className
    )
  )
  return (
    <Box
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Box>['style']}
      className="overflow-hidden border-continuous"
    />
  )
}

const DictionnaireItem = ({ word, onSelect }: DictionnaireItemProps) => {
  const stylingTheme = useStylingTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={word}
      onPress={onSelect}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <SectionItem>
        <Box className="overflow-hidden border-continuous flex-row">
          <Text
            className="text-[18px] text-default flex-[1] pr-[20px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {word}
          </Text>
        </Box>
      </SectionItem>
    </Pressable>
  )
}

export default DictionnaireItem
