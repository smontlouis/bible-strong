import React from 'react'
import { AnimatedProgressCircle } from '@convective/react-native-reanimated-progress'
import { useTheme } from '@emotion/react'

import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { wp } from '~helpers/utils'
import { Theme } from '~themes'
import { useTranslation } from 'react-i18next'

export const itemWidth = wp(50) > 300 ? 300 : wp(50)
export const itemHeight = 120

export const WidgetContainer = (props: any) => (
  <Box
    center
    rounded
    height={itemHeight}
    width={itemWidth}
    backgroundColor="reverse"
    marginRight={16}
    {...props}
  />
)

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
      <Text color="grey" marginTop={20} fontSize={12}>
        {t('Téléchargement en cours')}
      </Text>
    </WidgetContainer>
  )
}
