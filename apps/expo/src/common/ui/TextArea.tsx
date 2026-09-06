import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { TextInputProps } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'

const StyledTextArea = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TextInput>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge(
      'text-default border-border border-[2px] rounded-[10px] max-h-[300px] min-h-[150px] px-[15px] py-[30px]',
      className
    )
  )
  return (
    <NativeUI.TextInput
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.TextInput>['style']}
    />
  )
}

export default (props: TextInputProps) => {
  const theme = useTheme()
  return <StyledTextArea placeholderTextColor={theme.colors.grey} multiline {...props} />
}
