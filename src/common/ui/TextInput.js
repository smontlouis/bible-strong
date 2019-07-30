import styled from '@emotion/native'

const StyledTextInput = styled.TextInput(({ theme }) => ({
  color: theme.colors.default,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 2,
  paddingBottom: 10,
  marginTop: 10
}))

export default StyledTextInput
