// @flow
import React from 'react'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'

import Back from '~common/Back'
import SearchInput from './SearchInput'

const Container = styled.View(({ theme }) => ({
  backgroundColor: 'transparent',
  marginTop: theme.measures.headerMarginTop + 10,
  marginLeft: 20,
  marginRight: 20,
  flexDirection: 'row'
}))

const SearchHeader = ({ onChangeText, placeholder, hasBackButton, theme }) => (
  <Container>
    {hasBackButton && (
      <Back underlayColor='transparent'>
        <Icon name='chevron-left' size={28} color={theme.colors.reverse} />
      </Back>
    )}
    <SearchInput
      placeholder={placeholder}
      onChangeText={onChangeText}
    />
  </Container>
)

export default withTheme(SearchHeader)
