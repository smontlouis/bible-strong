import styled from '@emotion/native'

const Container = styled.SafeAreaView(({ grey, padding, theme }) => ({
  position: 'relative',
  flex: 1,
  backgroundColor: grey ? 'rgba(0,0,0,0.05)' : theme.colors.reverse,
  padding: padding
}))

export default Container
