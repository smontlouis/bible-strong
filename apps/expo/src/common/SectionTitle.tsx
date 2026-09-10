import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'

import Box from '~common/ui/Box'
import type { Theme as AppTheme } from '~themes'
import { Theme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

const SectionTitle = (
  componentProps: Omit<
    UIComponentProps<typeof Box>,
    keyof { color: keyof Theme['colors'] } | 'theme'
  > &
    Omit<{ color: keyof Theme['colors'] }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { color } = props
  const resolvedClassName = twMerge(
    'text-[20px] ml-[20px] mt-[10px] h-[30px] w-[30px] rounded-[15px] justify-center items-center overflow-visible',
    className
  )
  return (
    <Box
      {...props}
      style={
        [{ backgroundColor: theme.colors[color] }, props.style] as UIComponentProps<
          typeof Box
        >['style']
      }
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
    />
  )
}

export default SectionTitle
