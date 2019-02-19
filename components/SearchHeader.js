// @flow
import React from 'react'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { pure } from 'recompose'
import styled from '@emotion/native'

import Back from '@components/Back'
import SearchInput from '@components/SearchInput'

const Container = styled.View(({ theme }) => ({
  backgroundColor: 'transparent',
  marginTop: theme.measures.headerMarginTop + 10,
  marginLeft: 20,
  marginRight: 20,
  flexDirection: 'row'
}))

const SearchHeader = ({ onChangeText, placeholder, hasBackButton }) => (
  <Container>
    {hasBackButton && (
      <Back underlayColor='transparent'>
        <Icon name='chevron-left' size={28} color='white' />
      </Back>
    )}
    <SearchInput
      isLight
      placeholder={placeholder}
      onChangeText={onChangeText}
    />
  </Container>
)

export default pure(SearchHeader)
