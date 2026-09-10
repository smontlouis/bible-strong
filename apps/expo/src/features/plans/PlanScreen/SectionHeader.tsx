import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, useTheme } from '~themes/ThemeProvider'
import { AnimatedProgressCircle } from '@convective/react-native-reanimated-progress'
import Lottie from 'lottie-react-native'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

import { Image } from 'expo-image'
import Link from '~common/Link'
import { ComputedSection } from '~common/types'
import Border from '~common/ui/Border'
import Box, { AnimatedBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { Theme } from '~themes'
import { useFireStorage } from '../plan.hooks'

const CircleImage = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'absolute top-[2px] right-[0px] left-[2px] bottom-[0px] w-[34px] h-[34px] rounded-[17px] bg-light-grey',
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

const Section = ({
  id,
  title,
  subTitle,
  progress,
  toggle,
  isCollapsed,
  image,
}: Omit<ComputedSection, 'data'> & {
  toggle: (id: string) => void
  isCollapsed: boolean
}) => {
  const stylingTheme = useStylingTheme()

  const theme: Theme = useTheme()
  const cacheImage = useFireStorage(image)
  const isSectionCompleted = progress === 1
  return (
    <Link onPress={() => toggle(id)}>
      <Box className="overflow-hidden border-continuous flex-row pl-[20px] py-[20px] bg-reverse">
        {isSectionCompleted ? (
          <Lottie
            autoPlay
            loop={false}
            style={{
              width: 40,
              height: 40,
            }}
            source={require('../../../assets/images/medal.json')}
          />
        ) : (
          <AnimatedProgressCircle
            size={38}
            progress={progress}
            color={theme.colors.primary}
            unfilledColor={progress ? 'rgb(230,230,230)' : undefined}
            animationDuration={300}
          >
            <CircleImage className="items-center justify-center">
              {cacheImage && (
                <Image
                  style={{ width: 26, height: 26 }}
                  source={{
                    uri: cacheImage,
                  }}
                />
              )}
              {title && !cacheImage && (
                <Box className="overflow-hidden border-continuous">
                  <Text
                    className="text-[14px] text-primary"
                    style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
                  >
                    {title.substr(0, 1)}
                  </Text>
                </Box>
              )}
            </CircleImage>
          </AnimatedProgressCircle>
        )}

        <Box className="overflow-hidden border-continuous flex-[1] pl-[20px] justify-center">
          <Text>{title}</Text>
          {subTitle && <Text className="opacity-[0.6]">{subTitle}</Text>}
        </Box>
        <Box className="overflow-hidden border-continuous w-[40px] items-center justify-center">
          <AnimatedBox
            className="overflow-hidden border-continuous w-[17px] h-[17px] items-center justify-center"
            style={{
              transform: [{ rotate: isCollapsed ? '180deg' : '0deg' }],
              transitionProperty: 'transform',
              transitionDuration: 500,
            }}
          >
            <FeatherIcon color="grey" name="chevron-down" size={17} />
          </AnimatedBox>
        </Box>
      </Box>
      <Border />
    </Link>
  )
}

export default Section
