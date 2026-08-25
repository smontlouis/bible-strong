import Box, { BoxProps } from './Box'
import Text from './Text'

export const Chip = ({
  children,
  variant,
  ...props
}: BoxProps & { children: React.ReactNode; variant?: 'default' | 'bold' }) => {
  return (
    <Box px={6} py={3} maxW={90} row borderRadius={6} center bg="lightPrimary" {...props}>
      <Text fontSize={10} color="primary" fontWeight={variant === 'bold' ? 'bold' : 'normal'}>
        {children}
      </Text>
    </Box>
  )
}
