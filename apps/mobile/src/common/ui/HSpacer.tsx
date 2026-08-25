import styled from '@emotion/native'
import Box from './Box'

const HSpacer = styled(Box)(({ size = 1 }) => ({
  marginLeft: size * 15,
}))

export default HSpacer
