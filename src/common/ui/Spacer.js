import styled from '@emotion/native'
import Box from './Box'

const Spacer = styled(Box)(({ size = 1 }) => ({
  marginTop: size * 15,
}))

export default Spacer
