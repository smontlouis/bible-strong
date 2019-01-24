import React from 'react'
import { TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import { pure } from 'recompose'

const Text = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontWeight: isSelected ? 'bold' : 'normal',
  fontSize: 16,
  padding: 15,
  paddingTop: 10,
  paddingBottom: 10
}))

const BookSelectorItem = ({ book, isSelected, onChange }) => (
  <TouchableOpacity onPress={() => onChange(book)}>
    <Text isSelected={isSelected}>{book.Nom}</Text>
  </TouchableOpacity>
)

export default pure(BookSelectorItem)
