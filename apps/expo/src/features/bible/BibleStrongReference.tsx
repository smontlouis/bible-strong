import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import type { LayoutChangeEvent, TextStyle } from 'react-native'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import Paragraph from '~common/ui/Paragraph'
import { StrongResourceScrollConsumer } from './StrongResourceScrollContext'

type SelectableProps = {
  isSelected?: boolean
}

export type StrongVerseTextStyle = Pick<TextStyle, 'fontSize' | 'lineHeight'>

const StyledView = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.TouchableOpacity>,
    keyof SelectableProps | 'theme'
  > &
    Omit<SelectableProps, 'theme'> & { theme?: AppTheme; className?: string }
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
          { backgroundColor: isSelected ? theme.colors.primary : theme.colors.lightPrimary },
          props.style,
        ] as UIComponentProps<typeof NativeUI.TouchableOpacity>['style']
      }
    />
  )
}

const StyledCircle = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.TouchableOpacity>,
    keyof SelectableProps | 'theme'
  > &
    Omit<SelectableProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('w-[25px] h-[25px] bg-light-primary items-center justify-center mx-[3px]', className)
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [classStyles, { borderRadius: 25 / 2 }, props.style] as UIComponentProps<
          typeof NativeUI.TouchableOpacity
        >['style']
      }
    />
  )
}

const StyledInsideCircle = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.View>,
    keyof (SelectableProps & { isConcordance?: boolean }) | 'theme'
  > &
    Omit<SelectableProps & { isConcordance?: boolean }, 'theme'> & {
      theme?: AppTheme
      className?: string
    }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isSelected, isConcordance } = props
  const classStyles = useResolveClassNames(twMerge('items-center justify-center', className))
  return (
    <NativeUI.View
      {...props}
      style={
        [
          classStyles,
          {
            width: isConcordance ? 12 : 15,
            height: isConcordance ? 12 : 15,
            borderRadius: isConcordance ? 15 : 15 / 2,
            marginHorizontal: isConcordance ? 4 : 0,
            marginTop: isConcordance ? 0 : 0,
            backgroundColor:
              isSelected || isConcordance ? theme.colors.primary : theme.colors.lightPrimary,
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.View>['style']
      }
    />
  )
}

const StyledText = (
  componentProps: Omit<
    UIComponentProps<typeof Paragraph>,
    keyof (SelectableProps & { isFromConcordance?: boolean }) | 'theme'
  > &
    Omit<SelectableProps & { isFromConcordance?: boolean }, 'theme'> & {
      theme?: AppTheme
      className?: string
    }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isFromConcordance, isSelected } = props
  const classStyles = useResolveClassNames(twMerge('', className))
  return (
    <Paragraph
      {...props}
      style={
        [
          classStyles,
          {
            color: isSelected ? theme.colors.reverse : theme.colors.default,
            ...(isFromConcordance
              ? {
                  color: 'red',
                  fontWeight: 'bold',
                  fontSize: 12,
                }
              : {}),
          },
          props.style,
        ] as UIComponentProps<typeof Paragraph>['style']
      }
    />
  )
}

const ConcordanceText = (
  componentProps: Omit<
    UIComponentProps<typeof Paragraph>,
    keyof { isConcordance?: boolean } | 'theme'
  > &
    Omit<{ isConcordance?: boolean }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isConcordance } = props
  const classStyles = useResolveClassNames(twMerge('', className))
  return (
    <Paragraph
      {...props}
      style={
        [
          classStyles,
          {
            ...(isConcordance
              ? {
                  color: theme.colors.primary,
                  textDecorationLine: 'underline',
                  textDecorationStyle: 'solid',
                  textDecorationColor: theme.colors.primary,
                }
              : {}),
          },
          props.style,
        ] as UIComponentProps<typeof Paragraph>['style']
      }
    />
  )
}

type BibleStrongRefProps = {
  small?: boolean
  reference: string
  word?: string
  book?: string | number
  concordanceFor?: string | number
  textStyle?: StrongVerseTextStyle
  occurrenceIndex: number
  selectionTargets?: { reference: string; occurrenceIndex: number }[]
}

const BibleStrongRef = ({
  small,
  reference,
  word,
  concordanceFor,
  textStyle,
  occurrenceIndex,
  selectionTargets,
}: BibleStrongRefProps) => {
  if (concordanceFor) {
    const isConcordance = `0${concordanceFor}` === reference || `${concordanceFor}` === reference

    if (!word && !isConcordance) {
      return null
    }

    if (!word) {
      return <StyledInsideCircle isConcordance={isConcordance} />
    }

    return (
      <ConcordanceText small={small} isConcordance={isConcordance} style={textStyle}>
        {word}
      </ConcordanceText>
    )
  }

  return (
    <StrongResourceScrollConsumer>
      {value => {
        if (!value) return null
        const { currentTarget, registerStrongWordLayout, scrollToStrongCard } = value
        const registerLayout = (event: LayoutChangeEvent) => {
          for (const target of selectionTargets ?? [{ reference, occurrenceIndex }]) {
            registerStrongWordLayout(target.occurrenceIndex, event.nativeEvent.layout.y)
          }
        }
        const isSelected = Boolean(
          currentTarget &&
          (selectionTargets ?? [{ reference, occurrenceIndex }]).some(
            target =>
              Number(currentTarget.code) === Number(target.reference) &&
              currentTarget.occurrenceIndex === target.occurrenceIndex
          )
        )
        if (!word) {
          return (
            <StyledCircle
              activeOpacity={0.5}
              onPress={() => scrollToStrongCard(reference, occurrenceIndex)}
              onLayout={registerLayout}
              isSelected={isSelected}
            >
              <StyledInsideCircle isSelected={isSelected} />
            </StyledCircle>
          )
        }

        return (
          <StyledView
            activeOpacity={0.5}
            onPress={() => scrollToStrongCard(reference, occurrenceIndex)}
            onLayout={registerLayout}
            isSelected={isSelected}
          >
            <StyledText isSelected={isSelected} style={textStyle}>
              {word}
            </StyledText>
          </StyledView>
        )
      }}
    </StrongResourceScrollConsumer>
  )
}

export default BibleStrongRef
