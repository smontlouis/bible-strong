// @flow
import React from 'react'
import * as Icon from '@expo/vector-icons'
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

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
  marginTop: 10
}))

const SearchHeader = ({ onChangeText, placeholder, hasBackButton, theme }) => (
  <Container>
    {hasBackButton && (
      <Back underlayColor='transparent' style={{ marginRight: 15 }}>
        <FeatherIcon
          name={'arrow-left'}
          size={20}
        />
      </Back>
    )}
    <SearchInput
      placeholder={placeholder}
      onChangeText={onChangeText}
    />
  </Container>
)

export default withTheme(SearchHeader)
