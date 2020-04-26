import styled from '@emotion/native'
import { getStatusBarHeight } from 'react-native-iphone-x-helper'
import { Theme } from '~themes'

const Container = styled.View(
  ({
    theme,
    pure,
    noPadding = false,
  }: {
    theme: Theme
    pure?: boolean
    noPadding?: boolean
  }) => ({
    paddingTop: noPadding ? 0 : getStatusBarHeight(),
    position: 'relative',
    flex: 1,
    backgroundColor: pure ? theme.colors.reverse : theme.colors.lightGrey,
  })
)

export default Container
