import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import * as NativeUI from 'react-native'
import { ActivityIndicator, StyleProp, ViewStyle } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'

import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import useTimeout from '~helpers/useTimeout'
import { Theme } from '~themes'

const Container = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('flex-[1] items-center justify-center min-h-[300px]', className)
  return (
    <NativeUI.View
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

interface Props {
  message?: string
  subMessage?: string
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
}

const Loading = ({ message, subMessage, style, children }: Props) => {
  const [isReady] = useTimeout(3000)
  const theme: Theme = useTheme()
  const { t } = useTranslation()

  return (
    <Container style={style}>
      {!children && (
        <ActivityIndicator
          accessibilityLabel={message || t('Chargement...')}
          accessibilityRole="progressbar"
          color={theme.colors.grey}
        />
      )}
      {message && (
        <Box className="overflow-hidden border-continuous">
          <Text className="mt-[20px]" accessibilityLiveRegion="polite">
            {message}
          </Text>
        </Box>
      )}
      {subMessage && isReady() && (
        <Box className="overflow-hidden border-continuous pl-[30px] pr-[30px]">
          <Text className="text-center mt-[5px] text-[12px]">{subMessage}</Text>
        </Box>
      )}
      {children && (
        <Box className="overflow-hidden border-continuous mt-[20px] w-[200px] ml-auto mr-auto items-center justify-center">
          {children}
        </Box>
      )}
    </Container>
  )
}

export default Loading
