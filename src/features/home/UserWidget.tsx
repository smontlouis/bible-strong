import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Carousel from 'react-native-reanimated-carousel'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Paragraph from '~common/ui/Paragraph'
import useLogin from '~helpers/useLogin'
import OfflineNotice from './OfflineNotice'
import VerseOfTheDay, { VERSE_CARD_HEIGHT } from './VerseOfTheDay'

const vodNb = [...Array(5).keys()]

const Container = styled.View(({ theme }) => ({
  backgroundColor: theme.colors.lightGrey,
  paddingTop: 20,
  paddingBottom: 0,
  overflow: 'visible',
}))

const UserWidget = () => {
  const [carouselWidth, setCarouselWidth] = React.useState(0)

  return (
    <Container>
      <OfflineNotice />
      <Box
        alignItems="center"
        justifyContent="center"
        overflow="visible"
        width="100%"
        onLayout={({ nativeEvent }) => {
          const nextWidth = Math.round(nativeEvent.layout.width)
          setCarouselWidth(currentWidth => (currentWidth === nextWidth ? currentWidth : nextWidth))
        }}
      >
        {carouselWidth > 0 && (
          <Carousel
            mode="vertical-stack"
            data={vodNb}
            loop={false}
            style={{
              width: carouselWidth,
              height: VERSE_CARD_HEIGHT,
              overflow: 'visible',
            }}
            contentContainerStyle={{
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible',
            }}
            itemWidth={Math.max(carouselWidth - 65, 0)}
            itemHeight={VERSE_CARD_HEIGHT}
            modeConfig={{
              snapDirection: 'right',
              stackInterval: -10,
              scaleInterval: 0.04,
              rotateZDeg: 0,
              opacityInterval: 0.4,
            }}
            renderItem={({ item: i }) => <VerseOfTheDay addDay={-(vodNb.length - 1 - i)} />}
            defaultIndex={vodNb.length - 1}
          />
        )}
      </Box>
    </Container>
  )
}

export const LoginPrompt = () => {
  const { isLogged } = useLogin()
  const { t } = useTranslation()

  if (isLogged) return null

  return (
    <Box paddingHorizontal={20} borderRadius={30} marginHorizontal={20} bg="primary" py={20}>
      <Paragraph scale={-1} bold color="reverse" marginBottom={20}>
        {t('Connectez-vous pour profiter de toutes les fonctionnalités de la Bible Strong !')}
      </Paragraph>
      <Button
        reverse
        route="Login"
        rightIcon={
          <Icon.Feather name="arrow-right" size={20} color="white" style={{ marginLeft: 10 }} />
        }
      >
        {t('Je me connecte')}
      </Button>
    </Box>
  )
}

export default UserWidget
