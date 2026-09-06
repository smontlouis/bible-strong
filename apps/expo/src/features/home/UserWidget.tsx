import * as Icon from '@expo/vector-icons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import * as NativeUI from 'react-native'
import Carousel from 'react-native-reanimated-carousel'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Paragraph from '~common/ui/Paragraph'
import useLogin from '~helpers/useLogin'
import type { Theme as AppTheme } from '~themes'
import OfflineNotice from './OfflineNotice'
import VerseOfTheDay, { VERSE_CARD_HEIGHT } from './VerseOfTheDay'
import { VISIBLE_VERSE_OF_THE_DAY_OFFSETS } from './verseOfTheDayPolicy'

const visibleVerseOffsets = [...VISIBLE_VERSE_OF_THE_DAY_OFFSETS]

const Container = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('bg-light-grey pt-[20px] pb-[0px] overflow-visible', className)
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const UserWidget = () => {
  const [carouselWidth, setCarouselWidth] = React.useState(0)

  return (
    <Container>
      <OfflineNotice />
      <Box
        className="border-continuous overflow-visible items-center justify-center w-[100%]"
        onLayout={({ nativeEvent }) => {
          const nextWidth = Math.round(nativeEvent.layout.width)
          setCarouselWidth(currentWidth => (currentWidth === nextWidth ? currentWidth : nextWidth))
        }}
      >
        {carouselWidth > 0 && (
          <Carousel
            mode="vertical-stack"
            data={visibleVerseOffsets}
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
            renderItem={({ item: addDay }) => <VerseOfTheDay addDay={addDay} />}
            defaultIndex={visibleVerseOffsets.length - 1}
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
    <Box className="overflow-hidden border-continuous px-[20px] rounded-[30px] mx-[20px] bg-primary py-[20px]">
      <Paragraph className="font-bold text-reverse mb-[20px]" scale={-1}>
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
