import * as Icon from '@expo/vector-icons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions, View } from 'react-native'
import { Carousel } from 'react-native-reanimated-carousel'
import { twMerge } from '~common/ui/classNames'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Paragraph from '~common/ui/Paragraph'
import { runAfterInteractions } from '~helpers/runAfterInteractions'
import useLogin from '~helpers/useLogin'
import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'
import OfflineNotice from './OfflineNotice'
import VerseOfTheDay, { VERSE_CARD_HEIGHT } from './VerseOfTheDay'
import { VISIBLE_VERSE_OF_THE_DAY_OFFSETS } from './verseOfTheDayPolicy'

const visibleVerseOffsets = [...VISIBLE_VERSE_OF_THE_DAY_OFFSETS]
const todayOffset = visibleVerseOffsets[visibleVerseOffsets.length - 1]

const Container = (
  componentProps: Omit<UIComponentProps<typeof View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('pt-[20px] pb-[0px] overflow-visible', className)
  return (
    <View
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof View>['style']}
    />
  )
}

const UserWidget = () => {
  const [carouselWidth, setCarouselWidth] = React.useState(0)
  const [activeVerseIndex, setActiveVerseIndex] = React.useState(visibleVerseOffsets.length - 1)
  const { width: windowWidth } = useWindowDimensions()
  // Today's card shows on the first frame; the carousel and the previous days mount once the
  // home has opened, so opening it builds one card instead of five.
  const [showPreviousDays, setShowPreviousDays] = React.useState(false)
  React.useEffect(() => {
    const task = runAfterInteractions(() => setShowPreviousDays(true))
    return () => task.cancel()
  }, [])

  return (
    <Container>
      <OfflineNotice />
      <Box
        className="border-continuous overflow-visible items-center justify-center w-[100%]"
        // Keep the carousel's room before it can measure, so the sections below never move.
        style={{ height: VERSE_CARD_HEIGHT }}
        onLayout={({ nativeEvent }) => {
          const nextWidth = Math.round(nativeEvent.layout.width)
          setCarouselWidth(currentWidth => (currentWidth === nextWidth ? currentWidth : nextWidth))
        }}
      >
        {showPreviousDays && carouselWidth > 0 ? (
          <Carousel
            layout={{
              type: 'vertical-stack',
              exitDirection: 'right',
              // The default is the window width read once at load: a card exiting after a rotation
              // to landscape would stop half on screen.
              exitDistance: windowWidth,
              spacing: -10,
              scaleStep: 0.04,
              rotation: 0,
              opacityStep: 0.4,
            }}
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
            // Same 20px gutter as the other home sections.
            itemSize={Math.max(carouselWidth - 40, 1)}
            onSnapToItem={setActiveVerseIndex}
            renderItem={({ item: addDay, index }) => (
              <Box
                accessibilityElementsHidden={index !== activeVerseIndex}
                importantForAccessibility={
                  index === activeVerseIndex ? 'auto' : 'no-hide-descendants'
                }
                pointerEvents={index === activeVerseIndex ? 'auto' : 'none'}
              >
                <VerseOfTheDay addDay={addDay} />
              </Box>
            )}
            defaultIndex={visibleVerseOffsets.length - 1}
          />
        ) : (
          // Where the carousel lays today's card: its 20px gutters, at the front of the stack.
          <Box className="w-[100%] px-[20px]">
            <VerseOfTheDay addDay={todayOffset} />
          </Box>
        )}
      </Box>
    </Container>
  )
}

export const LoginPrompt = ({ className }: { className?: string }) => {
  const { isLogged } = useLogin()
  const { t } = useTranslation()
  const theme = useTheme()

  if (isLogged) return null

  return (
    <Box
      className={twMerge(
        'overflow-hidden border-continuous px-[20px] rounded-[16px] mx-[20px] bg-primary py-[20px]',
        className
      )}
    >
      <Paragraph className="font-bold text-reverse mb-[20px]" scale={-1}>
        {t('Connectez-vous pour profiter de toutes les fonctionnalités de la Bible Strong !')}
      </Paragraph>
      {/* On the primary card the button is the page's light ground with dark text. */}
      <Button
        reverse
        route="Login"
        style={{ backgroundColor: theme.colors.reverse }}
        rightIcon={
          <Icon.Feather
            name="arrow-right"
            size={20}
            color={theme.colors.default}
            style={{ marginLeft: 10 }}
          />
        }
      >
        {t('Je me connecte')}
      </Button>
    </Box>
  )
}

export default UserWidget
