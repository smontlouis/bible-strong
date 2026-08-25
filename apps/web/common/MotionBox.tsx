import { chakra, ChakraProps, forwardRef } from '@chakra-ui/react'
import { motion, MotionProps } from 'framer-motion'

const MotionBox = motion(
  forwardRef<MotionProps & ChakraProps, 'div'>(
    ({ layoutId, whileHover, whileTap, layout, ...rest }, ref) => (
      //@ts-ignore
      <chakra.div ref={ref} {...(rest as ChakraProps)} />
    )
  )
)

export default MotionBox
