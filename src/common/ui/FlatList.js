import React from 'react'
import styled from '@emotion/native'
import { getBottomSpace } from 'react-native-iphone-x-helper'

const FlatList = styled.FlatList(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30
}))

export default ({ children, contentContainerStyle, ...props }) => (
  <FlatList
    {...props}
    contentContainerStyle={{ ...contentContainerStyle, paddingBottom: 10 + getBottomSpace() }}>
    {children}
  </FlatList>
)
