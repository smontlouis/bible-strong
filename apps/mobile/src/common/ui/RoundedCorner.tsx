import styled from '@emotion/native'
import Box from './Box'

interface RoundedCornerProps {
  reverse?: boolean
}

const RoundedCorner = styled(Box)<RoundedCornerProps>(({ theme, reverse }) => ({
  height: 30,
  backgroundColor: theme.colors.reverse,
  ...(reverse
    ? {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
      }
    : {
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
      }),
}))

export default RoundedCorner
