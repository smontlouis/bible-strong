import styled from '@emotion/native'
import Box from './Box'

const Border = styled(Box)(({ theme }) => ({
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

export default Border
