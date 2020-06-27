import React from 'react'
import styled from '@emotion/native'
import { useSelector } from 'react-redux'
import { pure } from 'recompose'

import { wp } from '~helpers/utils'

const TouchableOpacity = styled.TouchableOpacity(() => ({
  alignItems: 'center',
  justifyContent: 'center',
  height: 45,
  width: wp(100) / 5,
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

const BookSelectorItem = ({ book, isSelected, isNT, onChange }) => {
  const themeValue = useSelector(state => state.user.bible.settings.theme)
  const bookName = book.Nom.replace(/\s/g, '').substr(0, 3)
  return (
    <TouchableOpacity onPress={() => onChange(book)}>
      <Text isSelected={isSelected} isNT={isNT} themeValue={themeValue}>
        {bookName}
      </Text>
    </TouchableOpacity>
  )
}

export default pure(BookSelectorItem)
