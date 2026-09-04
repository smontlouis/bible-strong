import type { HTMLAttributes } from 'react'
import MotionBox from './MotionBox'

export const headingVariants = {
  initial: {
    opacity: 0,
    x: -5,
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
  enter: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
  exit: {
    opacity: 0,
    x: -5,
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
}

const Heading = ({ className = '', ...props }: HTMLAttributes<HTMLHeadingElement>) => {
  return (
    <MotionBox variants={headingVariants}>
      <h2 className={`text-3xl font-medium ${className}`} {...props} />
    </MotionBox>
  )
}

export default Heading
