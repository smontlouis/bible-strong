import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useRef, useState } from 'react'
import { TouchableOpacity } from 'react-native'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import PageContent from '~common/ui/PageContent'
import { alphabet } from '~helpers/alphabet'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { Theme } from '~themes'

const StyledText = (
  componentProps: Omit<UIComponentProps<typeof Text>, keyof { isSelected: boolean } | 'theme'> &
    Omit<{ isSelected: boolean }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { isSelected } = props
  const classStyles = useResolveClassNames(twMerge('', className))
  return (
    <Text
      {...props}
      style={
        [
          classStyles,
          { fontWeight: isSelected ? 'bold' : 'normal' },
          props.style,
        ] as UIComponentProps<typeof Text>['style']
      }
    />
  )
}

const StyledUnderline = (
  componentProps: Omit<
    UIComponentProps<typeof Box>,
    keyof { color?: keyof Theme['colors'] } | 'theme'
  > &
    Omit<{ color?: keyof Theme['colors'] }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { color } = props
  const classStyles = useResolveClassNames(
    twMerge('mt-[5px] h-[8px] w-[30px] rounded-[5px]', className)
  )
  return (
    <Box
      {...props}
      style={
        [
          classStyles,
          { backgroundColor: color ? theme.colors[color] : theme.colors.primary },
          props.style,
        ] as UIComponentProps<typeof Box>['style']
      }
      className="overflow-hidden border-continuous"
    />
  )
}

type AlphabetListProps = {
  color?: keyof Theme['colors']
  setLetter: (letter: string) => void
  letter: string
}

const AlphabetList = ({ color, setLetter, letter }: AlphabetListProps) => {
  const [width, setWidth] = useState(0)
  const CarouselAlphabet = useRef<ICarouselInstance>(null)
  const index = alphabet.findIndex(l => l === letter.toUpperCase())

  return (
    <Box className="overflow-hidden border-continuous bg-reverse pb-[7px]">
      <Border />
      <PageContent
        className="pt-[5px] h-[50px]"
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
      >
        <Carousel
          ref={CarouselAlphabet}
          mode="parallax"
          loop={false}
          defaultIndex={index}
          scrollAnimationDuration={200}
          modeConfig={{
            parallaxScrollingOffset: 0,
            parallaxScrollingScale: 0.75,
          }}
          onConfigurePanGesture={gestureChain => {
            gestureChain.activeOffsetX([-10, 10])
          }}
          style={{
            width,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          contentContainerStyle={{
            alignItems: 'center',
            justifyContent: 'center',
          }}
          itemWidth={36}
          itemHeight={44}
          data={alphabet}
          renderItem={({ item: section, index: itemIndex }) => (
            <TouchableOpacity
              accessibilityLabel={section.toUpperCase()}
              accessibilityRole="radio"
              accessibilityState={{ checked: letter === section }}
              onPress={() => {
                CarouselAlphabet.current?.scrollTo({ index: itemIndex, animated: true })
                setLetter(section)
              }}
              style={{ minWidth: 36, minHeight: 44, justifyContent: 'center' }}
            >
              <Box className="overflow-hidden border-continuous">
                <StyledText className="text-center text-[26px]" isSelected={letter === section}>
                  {section.toUpperCase()}
                </StyledText>
              </Box>
            </TouchableOpacity>
          )}
          onSnapToItem={index => setLetter(alphabet[index])}
        />
        <Box className="overflow-hidden border-continuous items-center justify-center">
          <StyledUnderline color={color} />
        </Box>
      </PageContent>
    </Box>
  )
}

export default AlphabetList
