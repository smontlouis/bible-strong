import Box, { BoxProps } from './Box'
import Text from './Text'

export const Chip = ({ children, ...props }: BoxProps & { children: React.ReactNode }) => {
  return (
    <Box px={6} py={3} maxW={90} row borderRadius={6} center bg="lightPrimary" {...props}>
      <Text fontSize={10} color="primary">
        {children}
      </Text>
    </Box>
  )
}
