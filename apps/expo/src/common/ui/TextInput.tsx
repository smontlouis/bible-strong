import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import * as NativeUI from 'react-native'
import { TextInputProps as RNTextInputProps } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import Box from '~common/ui/Box'
import type { Theme as AppTheme } from '~themes'
import { Theme } from '~themes'
import { resolveTextTypography } from './textTypography'
import { useTheme, withTheme } from '~themes/ThemeProvider'

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
  const { theme: themeOverride, className, ...props } = componentProps
  const inheritedTheme = useTheme()
  const theme = themeOverride ?? inheritedTheme

  const { leftIcon } = props
  const resolvedClassName = twMerge(
    'text-default h-[48px] border-border border-[2px] rounded-[10px]',
    className
  )
  return (
    <NativeUI.TextInput
      {...props}
      className={resolvedClassName}
      style={resolveTextTypography(theme.fontFamily.text, [
        { paddingLeft: leftIcon ? 45 : 15 },
        props.style,
      ])}
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

  const resolvedClassName = twMerge('absolute left-[15px] bottom-[13px]', className)
  return (
    <Box
      {...props}
      style={[props.style] as UIComponentProps<typeof Box>['style']}
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
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
