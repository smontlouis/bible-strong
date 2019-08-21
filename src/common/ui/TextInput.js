import styled from '@emotion/native'

const StyledTextInput = styled.TextInput(({ theme, noBorder }) => ({
  color: theme.colors.default,
  paddingBottom: 10,
  marginTop: 10,
  ...(!noBorder && {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 2
  })
}))

export default StyledTextInput
