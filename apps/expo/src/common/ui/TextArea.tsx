import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { TextInputProps, TextInput } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'

const StyledTextArea = (
  componentProps: Omit<UIComponentProps<typeof TextInput>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'text-default border-border border-[2px] rounded-[10px] max-h-[300px] min-h-[150px] px-[15px] py-[30px]',
    className
  )
  return (
    <TextInput
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof TextInput>['style']}
    />
  )
}

export default (props: TextInputProps) => {
  const theme = useTheme()
  return <StyledTextArea placeholderTextColor={theme.colors.grey} multiline {...props} />
}
