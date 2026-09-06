import { twMerge } from '~common/ui/classNames'
import Box, { BoxProps } from './Box'
import Text from './Text'

export const Chip = ({
  children,
  variant,
  ...props
}: BoxProps & { children: React.ReactNode; variant?: 'default' | 'bold' }) => {
  return (
    <Box
      {...props}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge(
          'overflow-hidden border-continuous px-[6px] py-[3px] max-w-[90px] rounded-[6px] bg-light-primary items-center justify-center flex-row',
          props.className
        )
      )}
    >
      <Text
        className="text-primary text-[10px]"
        style={{ fontWeight: variant === 'bold' ? 'bold' : 'normal' }}
      >
        {children}
      </Text>
    </Box>
  )
}
