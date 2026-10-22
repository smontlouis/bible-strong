import { twMerge } from '~common/ui/classNames'

import { Platform } from 'react-native'
import Text from '~common/ui/Text'
const InterlinearMark = ({
  highlighted = false,
  passive = false,
  className,
}: {
  highlighted?: boolean
  passive?: boolean
  className?: string
}) => {
  return (
    <Text
      className={twMerge(
        passive ? 'text-default' : highlighted ? 'text-link' : 'text-tertiary',
        'text-[17px] font-bold',
        className
      )}
      style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }}
    >
      I
    </Text>
  )
}

export default InterlinearMark
