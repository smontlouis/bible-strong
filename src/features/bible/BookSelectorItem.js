import React from 'react'
import { Dimensions } from 'react-native'
import styled from '@emotion/native'
import { pure } from 'recompose'

const { width: viewportWidth } = Dimensions.get('window')

const TouchableOpacity = styled.TouchableOpacity(() => ({
  alignItems: 'center',
  justifyContent: 'center',
  height: 45,
  width: viewportWidth / 5
}))

const Text = styled.Text(({ isSelected, isNT, theme }) => ({
  color: isSelected
    ? theme.colors.primary
    : isNT
      ? theme.colors.quart
      : theme.colors.default,
  fontWeight: isSelected ? 'bold' : 'normal',
  fontSize: 16
}))

const BookSelectorItem = ({ book, isSelected, isNT, onChange }) => {
  const bookName = book.Nom.replace(/\s/g, '').substr(0, 3)
  return (
    <TouchableOpacity onPress={() => onChange(book)}>
      <Text isSelected={isSelected} isNT={isNT}>
        {bookName}
      </Text>
    </TouchableOpacity>
  )
}

export default pure(BookSelectorItem)
