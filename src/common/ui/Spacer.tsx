import styled from '@emotion/native'
import Box from './Box'

interface SpacerProps {
  size?: number
}

const Spacer = styled(Box)<SpacerProps>(({ size = 1 }) => ({
  marginTop: size * 15,
}))

export default Spacer
