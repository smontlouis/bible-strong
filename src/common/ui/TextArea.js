import styled from '@emotion/native'

const StyledTextArea = styled.TextInput(({ theme }) => ({
  color: theme.colors.default,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 2,
  paddingBottom: 10,
  marginTop: 20,
  maxHeight: 200
}))

export default StyledTextArea
