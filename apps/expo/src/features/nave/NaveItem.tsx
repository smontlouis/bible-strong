import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { memo, useCallback } from 'react'
import { Pressable } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

interface NaveItemProps {
  name_lower: string
  name: string
  onSelect?: (name_lower: string, name: string) => void
}

const SectionItem = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'h-[60px] ml-[20px] mr-[20px] bg-reverse border-b-border border-b-[1px] items-start justify-center',
    className
  )
  return (
    <Box
      {...props}
      style={[props.style] as UIComponentProps<typeof Box>['style']}
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
    />
  )
}

const NaveItem = memo(({ name_lower, name, onSelect }: NaveItemProps) => {
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
    <SectionItem>
      <Box className="overflow-hidden border-continuous flex-row">
        <Text
          className="text-[18px] text-default flex-[1] pr-[20px]"
          style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
        >
          {name}
        </Text>
      </Box>
    </SectionItem>
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
