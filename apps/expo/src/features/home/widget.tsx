import { twMerge } from '~common/ui/classNames'
import React, { createContext, useContext } from 'react'
import { AnimatedProgressCircle } from '@convective/react-native-reanimated-progress'
import { useTheme } from '~themes/ThemeProvider'
import Loading from '~common/Loading'
import Box, { BoxProps } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { wp } from '~helpers/utils'
import { Theme } from '~themes'
import { useTranslation } from 'react-i18next'
export const itemWidth = wp(50) > 300 ? 300 : wp(50)
export const itemHeight = 120

export const WidgetWidthContext = createContext<number | '100%' | undefined>(undefined)

export const WidgetContainer = (props: BoxProps) => {
  const width = useContext(WidgetWidthContext)
  return (
    <Box
      {...props}
      style={[
        { width: width ?? itemWidth, height: itemHeight },
        width !== undefined && { marginRight: 0 },
        props.style,
      ]}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge(
          'overflow-hidden border-continuous mr-[16px] bg-reverse items-center justify-center rounded-[20px]',
          props.className
        )
      )}
    />
  )
}

export const WidgetLoading = () => {
  return (
    <WidgetContainer>
      <Loading />
    </WidgetContainer>
  )
}

export const DownloadingWidget = ({ progress }: { progress?: number }) => {
  const theme: Theme = useTheme()
  const { t } = useTranslation()
  return (
    <WidgetContainer>
      <AnimatedProgressCircle
        size={30}
        progress={progress}
        thickness={2}
        color={theme.colors.primary}
        unfilledColor={theme.colors.lightGrey}
        animationDuration={300}
      />
      <Text className="text-grey mt-[20px] text-[12px]">{t('Téléchargement en cours')}</Text>
    </WidgetContainer>
  )
}
