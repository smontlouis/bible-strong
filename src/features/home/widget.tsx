import React from 'react'
import ProgressCircle from 'react-native-progress/Circle'
import { useTheme } from 'emotion-theming'

import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { wp } from '~helpers/utils'
import { Theme } from '~themes'

export const itemWidth = wp(50) > 300 ? 300 : wp(50)
export const itemHeight = 120

export const WidgetContainer = props => (
  <Box
    center
    rounded
    height={itemHeight}
    width={itemWidth}
    backgroundColor="reverse"
    marginRight={20}
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
  return (
    <WidgetContainer>
      <ProgressCircle
        size={30}
        progress={progress}
        borderWidth={0}
        thickness={2}
        color={theme.colors.primary}
        unfilledColor={theme.colors.lightGrey}
      />
      <Text color="grey" marginTop={20} fontSize={12}>
        Téléchargement en cours
      </Text>
    </WidgetContainer>
  )
}
