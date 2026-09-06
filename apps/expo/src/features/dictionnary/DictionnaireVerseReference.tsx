import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import Paragraph from '~common/ui/Paragraph'
import { CarouselConsumer } from '~helpers/CarouselContext'

interface SelectedProps {
  isSelected: boolean
}

const StyledView = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.TouchableOpacity>,
    keyof SelectedProps | 'theme'
  > &
    Omit<SelectedProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isSelected } = props
  const classStyles = useResolveClassNames(
    twMerge('rounded-[5px] pl-[3px] pr-[3px] mb-[5px] overflow-hidden', className)
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [
          classStyles,
          { backgroundColor: isSelected ? theme.colors.secondary : theme.colors.lightSecondary },
          props.style,
        ] as UIComponentProps<typeof NativeUI.TouchableOpacity>['style']
      }
    />
  )
}

const StyledText = (
  componentProps: Omit<UIComponentProps<typeof Paragraph>, keyof SelectedProps | 'theme'> &
    Omit<SelectedProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isSelected } = props
  const classStyles = useResolveClassNames(twMerge('', className))
  return (
    <Paragraph
      {...props}
      style={
        [
          classStyles,
          { color: isSelected ? theme.colors.reverse : theme.colors.default },
          props.style,
        ] as UIComponentProps<typeof Paragraph>['style']
      }
    />
  )
}

interface DictionnaireRefProps {
  word: string
}

const DictionnaireRef = ({ word }: DictionnaireRefProps) => {
  const lowerWord = word.toLowerCase()

  return (
    <CarouselConsumer>
      {value => {
        if (!('current' in value)) {
          return null
        }

        const isSelected = value.current === lowerWord

        return (
          <>
            <StyledView
              activeOpacity={0.5}
              onPress={() => value.setCurrent(lowerWord)}
              isSelected={isSelected}
            >
              <StyledText isSelected={isSelected}>{word}</StyledText>
            </StyledView>
            <Paragraph> </Paragraph>
          </>
        )
      }}
    </CarouselConsumer>
  )
}

export default DictionnaireRef
