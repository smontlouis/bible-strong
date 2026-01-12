import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions } from 'react-native'
import Carousel from 'react-native-reanimated-carousel'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import useLogin from '~helpers/useLogin'
import OfflineNotice from './OfflineNotice'
import PreloadBible from './PreloadBible'
import VerseOfTheDay, { VERSE_CARD_HEIGHT } from './VerseOfTheDay'

const vodNb = [...Array(5).keys()]

const Container = styled.View(({ theme }) => ({
  backgroundColor: theme.colors.lightGrey,
  paddingTop: 20,
  paddingBottom: 0,
  overflow: 'visible',
}))

const UserWidget = () => {
  const { isLogged } = useLogin()
  const { t } = useTranslation()
  const { width } = useWindowDimensions()

  if (!isLogged) {
    return (
      <Container>
        <Box paddingHorizontal={20} borderRadius={30} marginHorizontal={20} bg="reverse" py={20}>
          <Text marginTop={20} title fontSize={25} flex>
            {t('Bienvenue')}
          </Text>
          <Paragraph marginTop={20} marginBottom={20}>
            {t('Connectez-vous pour profiter de toutes les fonctionnalités de la Bible Strong !')}
          </Paragraph>
          <Button
            route="Login"
            rightIcon={
              <Icon.Feather name="arrow-right" size={20} color="white" style={{ marginLeft: 10 }} />
            }
          >
            {t('Je me connecte')}
          </Button>
        </Box>
      </Container>
    )
  }

  return (
    <Container>
      <OfflineNotice />
      <PreloadBible>
        <Box alignItems="center" justifyContent="center" overflow="visible">
          <Carousel
            mode="vertical-stack"
            data={vodNb}
            loop={false}
            style={{
              width: width,
              height: VERSE_CARD_HEIGHT,
              overflow: 'visible',
            }}
            contentContainerStyle={{
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible',
            }}
            itemWidth={width - 65}
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
        </Box>
      </PreloadBible>
    </Container>
  )
}

export default UserWidget
