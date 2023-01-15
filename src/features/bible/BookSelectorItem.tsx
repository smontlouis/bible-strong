import styled from '@emotion/native'
import React from 'react'
import { pure } from 'recompose'

import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { wp } from '~helpers/utils'

const TouchableOpacity = styled.TouchableOpacity(() => ({
  alignItems: 'center',
  justifyContent: 'center',
  height: 45,
  width: wp(99) / 5,
}))

const Text = styled.Text(({ isSelected, isNT, themeValue, theme }) => ({
  color: isSelected
    ? theme.colors.primary
    : isNT
    ? themeValue === 'default'
      ? theme.colors.quart
      : theme.colors.tertiary
    : theme.colors.default,
  fontWeight: isSelected ? 'bold' : 'normal',
  fontSize: 16,
}))

const BookSelectorItem = ({ book, isSelected, isNT, onChange, t }) => {
  const { theme } = useCurrentThemeSelector()
  const bookName = t(book.Nom)
    .replace(/\s/g, '')
    .substr(0, 3)
  return (
    <TouchableOpacity onPress={() => onChange(book)}>
      <Text isSelected={isSelected} isNT={isNT} themeValue={theme}>
        {bookName}
      </Text>
    </TouchableOpacity>
  )
}

export default pure(BookSelectorItem)
