// @flow
import React from 'react'
import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'
import { withTheme } from '@emotion/react'

import Back from '~common/Back'
import SearchInput from '~common/SearchInput'

const Container = styled.View(({ theme }) => ({
  backgroundColor: 'transparent',
  marginTop: theme.measures.headerMarginTop + 10,
  marginLeft: 20,
  marginRight: 20,
  flexDirection: 'row',
}))

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
  marginTop: 10,
}))

const SearchHeader = ({
  onChangeText,
  placeholder,
  hasBackButton,
  onDelete,
}) => (
  <Container>
    {hasBackButton && (
      <Back padding>
        <FeatherIcon name="arrow-left" size={20} />
      </Back>
    )}
    <SearchInput
      placeholder={placeholder}
      onChangeText={onChangeText}
      onDelete={onDelete}
    />
  </Container>
)

export default withTheme(SearchHeader)
