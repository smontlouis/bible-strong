import { getStatusBarHeight } from 'react-native-iphone-x-helper'
import styled from '@emotion/native'
import Box from './Box'

console.log('coucou', getStatusBarHeight())
const Container = styled(Box)<{
  pure?: boolean
  noPadding?: boolean
}>(({ theme, pure, noPadding = false }) => ({
  paddingTop: noPadding ? 0 : getStatusBarHeight(),
  position: 'relative',
  flex: 1,
  backgroundColor: pure ? theme.colors.reverse : theme.colors.lightGrey,
}))

export default Container
