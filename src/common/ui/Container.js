import styled from '@emotion/native'
import { getStatusBarHeight } from 'react-native-iphone-x-helper'

const Container = styled.View(({ theme }) => ({
  paddingTop: getStatusBarHeight(),
  position: 'relative',
  flex: 1,
  backgroundColor: theme.colors.lightGrey
}))

export default Container
