import React from 'react'
import { TouchableOpacity } from 'react-native'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const formatText = (sentence, array) => {
  return array.reduce(
    ({ offset, result, phrase }, [position, range], i) => {
      const before = phrase.substr(0, position - offset)
      const highlighted = (
        <Text bold primary key={i}>
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
    { offset: 0, phrase: sentence, result: [] }
  )
}

const SearchItem = ({ reference, text, positions, onPress }) => {
  const { result } = formatText(text, positions)
  return (
    <TouchableOpacity onPress={onPress}>
      <Box
        paddingTop={15}
        paddingBottom={20}
        style={{ borderBottomWidth: 1, borderBottomColor: 'rgb(230,230,230)' }}
      >
        <Text title fontSize={16} marginBottom={5}>
          {reference}
        </Text>
        <Paragraph>{result}</Paragraph>
      </Box>
    </TouchableOpacity>
  )
}

export default SearchItem
