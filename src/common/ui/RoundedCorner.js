import styled from '@emotion/native'
import Box from './Box'

const RoundedCorner = styled(Box)(({ theme }) => ({
  height: 30,
  backgroundColor: theme.colors.reverse,
  borderBottomLeftRadius: 30,
  borderBottomRightRadius: 30
}))

export default RoundedCorner
