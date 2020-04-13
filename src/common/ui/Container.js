import styled from '@emotion/native'
import { getStatusBarHeight } from 'react-native-iphone-x-helper'

const Container = styled.View(({ theme, pure, noPadding = false }) => ({
  paddingTop: noPadding ? 0 : getStatusBarHeight(),
  position: 'relative',
  flex: 1,
  backgroundColor: pure ? theme.colors.reverse : theme.colors.lightGrey,
}))

export default Container
