import { twMerge } from '~common/ui/classNames'

import { Platform } from 'react-native'
import Text from '~common/ui/Text'
const StrongMark = ({
  highlighted = false,
  passive = false,
}: {
  highlighted?: boolean
  passive?: boolean
}) => {
  return (
    <Text
      className={twMerge(
        passive
          ? highlighted
            ? 'text-primary'
            : 'text-default'
          : highlighted
            ? 'text-primary'
            : 'text-tertiary',
        'text-[17px] font-bold'
      )}
      style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }}
    >
      S
    </Text>
  )
}

export default StrongMark
