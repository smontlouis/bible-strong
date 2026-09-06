import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import * as NativeUI from 'react-native'
import { TextInputProps as RNTextInputProps } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import Box from '~common/ui/Box'
import type { Theme as AppTheme } from '~themes'
import { Theme } from '~themes'
import { withTheme } from '~themes/ThemeProvider'

interface StyledTextInputProps {
  leftIcon?: React.ReactNode
}

const StyledTextInput = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.TextInput>,
    keyof StyledTextInputProps | 'theme'
  > &
    Omit<StyledTextInputProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { leftIcon } = props
  const classStyles = useResolveClassNames(
    twMerge('text-default h-[48px] border-border border-[2px] rounded-[10px]', className)
  )
  return (
    <NativeUI.TextInput
      {...props}
      style={
        [classStyles, { paddingLeft: leftIcon ? 45 : 15 }, props.style] as UIComponentProps<
          typeof NativeUI.TextInput
        >['style']
      }
    />
  )
}

const LeftIcon = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('absolute left-[15px] bottom-[13px]', className))
  return (
    <Box
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Box>['style']}
      className="overflow-hidden border-continuous"
    />
  )
}

interface TextInputWrapperProps extends RNTextInputProps {
  theme: Theme
  leftIcon?: React.ReactNode
}

export default withTheme((props: TextInputWrapperProps) => (
  <Box className="overflow-hidden border-continuous relative">
    {props.leftIcon && <LeftIcon>{props.leftIcon}</LeftIcon>}
    <StyledTextInput
      accessibilityLabel={props.accessibilityLabel ?? props.placeholder}
      placeholderTextColor={props.theme.colors.grey}
      {...props}
    />
  </Box>
))
