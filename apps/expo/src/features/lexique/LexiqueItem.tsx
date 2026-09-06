import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, useTheme as useAppTheme } from '~themes/ThemeProvider'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { Pressable } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'

import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { StrongLexiconSearchResult } from '~features/resources/strongLexiconAccess'

const SectionItem = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge(
      'h-[80px] ml-[20px] mr-[20px] bg-reverse border-b-border border-b-[1px] items-start justify-center',
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

interface ChipProps {
  isHebreu?: boolean
}

const Chip = (
  componentProps: Omit<UIComponentProps<typeof Box>, keyof ChipProps | 'theme'> &
    Omit<ChipProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isHebreu } = props
  const classStyles = useResolveClassNames(
    twMerge('rounded-[10px] pt-[2px] pb-[2px] pl-[5px] pr-[5px] mb-[3px]', className)
  )
  return (
    <Box
      {...props}
      style={
        [
          classStyles,
          { backgroundColor: isHebreu ? theme.colors.lightPrimary : theme.colors.border },
          props.style,
        ] as UIComponentProps<typeof Box>['style']
      }
      className="overflow-hidden border-continuous"
    />
  )
}

interface LexiqueItemProps extends StrongLexiconSearchResult {
  onSelect?: (book: number, reference: string, title?: string) => void
}

const LexiqueItem = ({ stepCode, language, original, gloss, onSelect }: LexiqueItemProps) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const book = language === 'hebrew' ? 1 : 40
  const lexiqueType = language === 'hebrew' ? 'Hébreu' : 'Grec'

  const handlePress = () => {
    onSelect?.(book, stepCode, gloss)
  }

  const content = (
    <SectionItem>
      <Box className="overflow-hidden border-continuous flex-row">
        <Chip isHebreu={language === 'hebrew'}>
          <Text className="text-[10px]">{t(lexiqueType)}</Text>
        </Chip>
        <Chip className="ml-[5px]">
          <Text className="text-[10px]">{stepCode}</Text>
        </Chip>
      </Box>
      <Box className="overflow-hidden border-continuous flex-row">
        <Text
          className="text-[18px] text-default flex-[1] pr-[20px]"
          style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
        >
          {gloss}
        </Text>
        <Text
          className="text-[18px] text-default"
          accessibilityLanguage={language === 'hebrew' ? 'he-IL' : 'el-GR'}
        >
          {original}
        </Text>
      </Box>
    </SectionItem>
  )

  if (onSelect) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={handlePress}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        {content}
      </Pressable>
    )
  }

  return (
    <Link route="Strong" params={{ book, reference: stepCode }}>
      {content}
    </Link>
  )
}

export default LexiqueItem
