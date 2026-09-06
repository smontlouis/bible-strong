import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import type { Theme as AppTheme } from '~themes'

const Container = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('pt-[15px] pb-[20px] border-b-[1px] border-b-border', className)
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [classStyles, {}, props.style] as UIComponentProps<
          typeof NativeUI.TouchableOpacity
        >['style']
      }
    />
  )
}

type SearchPosition = [position: number, range: number]

const formatText = (sentence: string, array: SearchPosition[]) => {
  return array.reduce(
    ({ offset, result, phrase }, [position, range], i) => {
      const before = phrase.substr(0, position - offset)
      const highlighted = (
        <Text className="font-bold text-primary" key={i}>
          {phrase.substr(position - offset, range)}
        </Text>
      )
      const rest = phrase.substr(position + range - offset, phrase.length)

      result.push(before, highlighted)
      if (array.length - 1 === i) {
        result.push(rest)
      }

      offset = position + range
      phrase = rest

      return { offset, result, phrase }
    },
    { offset: 0, phrase: sentence, result: [] as React.ReactNode[] }
  )
}

type LocalSearchItemProps = {
  reference: string
  text: string
  positions: SearchPosition[]
  onPress: () => void
}

const LocalSearchItem = ({ reference, text, positions, onPress }: LocalSearchItemProps) => {
  const stylingTheme = useStylingTheme()

  const { result } = positions.length ? formatText(text, positions) : { result: text }
  return (
    <Container onPress={onPress}>
      <Text
        className="text-[16px] mb-[5px]"
        style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
      >
        {reference}
      </Text>
      <Paragraph small>{result}</Paragraph>
    </Container>
  )
}

export default LocalSearchItem
