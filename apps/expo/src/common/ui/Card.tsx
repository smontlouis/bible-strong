import { twMerge } from '~common/ui/classNames'
import Box, { type BoxProps } from './Box'

/** A surface on the canvas: its edge comes from the contrast alone, with no border and no shadow. */
const Card = ({ className, ...props }: BoxProps) => (
  <Box
    {...props}
    className={twMerge('overflow-hidden border-continuous rounded-[16px] bg-surface', className)}
  />
)

export default Card
