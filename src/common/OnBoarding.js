import React from 'react'
import Modal from 'react-native-modalbox'
import { useSelector, useDispatch } from 'react-redux'
import styled from '@emotion/native'
import { Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Carousel, { Pagination } from 'react-native-snap-carousel'
import { Button as RNPButton } from 'react-native-paper'

import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import { wp, hp } from '~helpers/utils'
import { setFirstTime } from '~redux/modules/user'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'

const slideWidth = wp(100)
const sliderWidth = wp(100)
const slideHeight = hp(70)

const itemWidth = slideWidth

const StylizedModal = styled(Modal)(({ theme }) => ({
  backgroundColor: theme.colors.primary
}))

const slides = [
  {
    title: 'Bienvenue,',
    description:
      'Accédez à un lexique hébreu/grec,\n un dictionnaire, des thématiques,\n des commentaires, tout cela\n depuis votre mobile !',
    image: require('../assets/images/Bible_Strong__First_Slide.png')
  },
  {
    title: 'Votre couteau suisse',
    description:
      'Prenez des notes, surlignez, organisez\n par étiquette, partagez.',
    image: require('../assets/images/Bible_Strong__Second_Slide.png')
  },
  {
    title: 'Personnalisable',
    description:
      "Thèmes jour/nuit, choix de polices,\n taille du texte... Modifiez l'application\n à votre convenance ! ",
    image: require('../assets/images/Bible_Strong__Third_Slide.png')
  },
  {
    title: 'Vos Études',
    description:
      'Un éditeur de texte riche et complet\n pour rédiger vos études, vos méditations,\n vos notes...',
    image: require('../assets/images/Bible_Strong__Fourth_Slide.png')
  },
  {
    title: 'Vos données en sécurité',
    description:
      'Créez un compte pour synchroniser\n vos données dans le cloud, et cela\n en tout sécurité !',
    image: require('../assets/images/Bible_Strong__Fifth_Slide.png')
  },
  {
    title: 'Accès hors-ligne',
    description:
      'Bible Strong a été pensé pour un accès avant tout hors-ligne. \n\nAvant de commencer, rendez-vous\n dans `Plus -> Gestion des téléchargements`\n pour télécharger tout ce dont vous avez\n besoin !'
  }
]

const Item = ({ item, index }) => {
  const r = useMediaQueriesArray()
  return (
    <Box
      center
      width={itemWidth}
      height={slideHeight}
      overflow="visible"
      paddingHorizontal={20}
    >
      {item.image && (
        <Image
          source={item.image}
          style={{
            width: r([wp(60), wp(80), 450, 500]),
            height: r([wp(50), wp(68), 380, 460])
          }}
        />
      )}
      <Text textAlign="center" title fontSize={24} marginTop={30}>
        {item.title}
      </Text>
      <Paragraph
        scale={-2}
        marginTop={15}
        marginBottom={r([10, 10, 40, 40])}
        textAlign="center"
      >
        {item.description}
      </Paragraph>
    </Box>
  )
}

const OnBoarding = () => {
  const dispatch = useDispatch()
  const r = useMediaQueriesArray()
  const [activeSlide, setActiveSlide] = React.useState(0)
  const isFirstTime = useSelector(state => state.user.isFirstTime)
  const carousel = React.useRef()

  return (
    <StylizedModal
      isOpen={isFirstTime}
      backdropPressToClose={false}
      swipeToClose={false}
    >
      <LinearGradient
        start={[0.1, 0.2]}
        style={{ flex: 1, justifyContent: 'center' }}
        colors={['white', 'white']}
      >
        <Box overflow="visible" center>
          <Carousel
            ref={carousel}
            data={slides}
            layoutCardOffset={15}
            renderItem={props => <Item {...props} />}
            sliderWidth={sliderWidth}
            itemWidth={itemWidth}
            inactiveSlideScale={1}
            inactiveSlideOpacity={0.3}
            contentContainerCustomStyle={{
              overflow: 'visible',
              paddingBottom: 0
            }}
            onSnapToItem={setActiveSlide}
            useScrollView={false}
          />
          <Pagination
            dotsLength={slides.length}
            activeDotIndex={activeSlide}
            containerStyle={{
              paddingVertical: 10
            }}
            dotContainerStyle={{
              width: 10,
              marginHorizontal: 3
            }}
            dotStyle={{
              width: 10,
              height: 10,
              borderRadius: 5,
              marginHorizontal: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.92)'
            }}
            inactiveDotOpacity={0.4}
            inactiveDotScale={0.6}
            carouselRef={carousel.current}
            tappableDots={!!carousel.current}
          />
          <Box width={170} marginTop={20}>
            {activeSlide === 5 ? (
              <Button onPress={() => dispatch(setFirstTime(false))}>
                Commencer
              </Button>
            ) : (
              <Button onPress={() => carousel.current?.snapToNext()}>
                Suivant
              </Button>
            )}
            <RNPButton
              style={{ marginTop: 5 }}
              mode="text"
              onPress={() => dispatch(setFirstTime(false))}
              labelStyle={{ fontSize: 12 }}
            >
              Passer
            </RNPButton>
          </Box>
        </Box>
      </LinearGradient>
    </StylizedModal>
  )
}

export default OnBoarding
