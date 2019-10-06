import styled from '@emotion/native'

const Container = styled.SafeAreaView(({ grey, padding, theme }) => ({
  position: 'relative',
  flex: 1,
  backgroundColor: grey ? theme.colors.lightGrey : theme.colors.reverse,
  padding
}))

export default Container
