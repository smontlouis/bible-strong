import Box from '~common/ui/Box'
import styled from '~styled'

const CircleImage = styled(Box)(({ size = 30, theme }) => ({
  width: size,
  height: size,
  borderRadius: size / 2,
  backgroundColor: theme.colors.lightGrey,
  borderColor: theme.colors.lightGrey,
}))

export default CircleImage
