import { Image, ImageSource } from 'expo-image'
import Lottie from 'lottie-react-native'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { useEffect, useRef } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
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

  const classStyles = useResolveClassNames(twMerge('flex-[1] items-center', className))
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

interface Props {
  message: string
  source?: React.ComponentProps<typeof Lottie>['source']
  icon?: ImageSource
  iconElement?: React.ReactNode
  children?: React.ReactNode
}

const Empty = ({ message, source, icon, iconElement, children, ...props }: Props) => {
  const theme = useTheme()
  const animation = useRef<Lottie>(null)

  useEffect(() => {
    if (animation.current) {
      animation.current.reset()
      animation.current.play()
    }
  }, [])

  return (
    <Container {...props}>
      <PageContent className="px-[20px] items-center justify-center flex-[1]">
        {icon && (
          <Box className="overflow-hidden border-continuous mb-[20px]">
            <Image
              source={icon}
              style={{ width: 80, height: 80, opacity: 0.6 }}
              tintColor={theme.colors.tertiary}
              contentFit="contain"
            />
          </Box>
        )}
        {iconElement && !icon && (
          <Box className="overflow-hidden border-continuous mb-[20px]">{iconElement}</Box>
        )}
        {source && !icon && !iconElement && (
          <Lottie
            ref={animation}
            style={{
              width: 200,
              height: 200,
              marginBottom: 20,
            }}
            source={source}
          />
        )}
        {message && <Text className="text-center text-tertiary">{message}</Text>}
        {children}
      </PageContent>
    </Container>
  )
}

export default Empty
