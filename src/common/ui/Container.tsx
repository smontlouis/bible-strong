import { getStatusBarHeight } from 'react-native-iphone-x-helper'
import styled from '@emotion/native'
import { ViewProps } from 'react-native'

const Container = styled.View<
  {
    pure?: boolean
    noPadding?: boolean
  } & ViewProps
>(({ theme, pure, noPadding = false }) => ({
  paddingTop: noPadding ? 0 : getStatusBarHeight(),
  position: 'relative',
  flex: 1,
  backgroundColor: pure ? theme.colors.reverse : theme.colors.lightGrey,
}))

export default Container
