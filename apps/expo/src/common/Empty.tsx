import { Image, ImageSource } from 'expo-image'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'

import Box from '~common/ui/Box'
import PageContent from '~common/ui/PageContent'
import Text from '~common/ui/Text'
import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'

const Container = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('w-full shrink-0 items-center px-[24px] py-[32px]', className)
  return (
    <Box
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

interface Props extends NativeUI.ViewProps {
  className?: string
  message: string
  illustration?: ImageSource
  icon?: ImageSource
  iconElement?: React.ReactNode
  children?: React.ReactNode
}

const Empty = ({
  message,
  icon,
  iconElement,
  illustration = require('~assets/images/empty-state-illustration.png'),
  children,
  ...props
}: Props) => {
  const theme = useTheme()
  return (
    <Container {...props}>
      <PageContent className="items-center justify-center">
        <Box className="relative mb-[20px] h-[180px] w-[180px]" pointerEvents="none">
          <Image
            source={illustration}
            style={{ width: 180, height: 180, opacity: 0.6 }}
            contentFit="contain"
            accessible={false}
          />
          {(icon || iconElement) && (
            <Box
              className="absolute left-[58px] top-[80px] w-[40px] h-[40px] items-center justify-center rotate-6 bg-gray-100 rounded-md"
              accessible={false}
            >
              {icon ? (
                <Image
                  source={icon}
                  style={{ width: 36, height: 36 }}
                  tintColor={theme.colors.tertiary}
                  contentFit="contain"
                  accessible={false}
                />
              ) : (
                iconElement
              )}
            </Box>
          )}
        </Box>
        {message && (
          <Text className="w-full max-w-[280px] leading-normal text-center text-tertiary">
            {message}
          </Text>
        )}
        {children && <Box className="mt-[16px] w-full items-center">{children}</Box>}
      </PageContent>
    </Container>
  )
}

export default Empty
