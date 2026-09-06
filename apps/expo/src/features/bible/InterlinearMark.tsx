import { twMerge } from '~common/ui/classNames'

import { Platform } from 'react-native'
import Text from '~common/ui/Text'
const InterlinearMark = ({
  highlighted = false,
  passive = false,
}: {
  highlighted?: boolean
  passive?: boolean
}) => {
  return (
    <Text
      className={twMerge(
        passive ? 'text-default' : highlighted ? 'text-primary' : 'text-tertiary',
        'text-[17px] font-bold'
      )}
      style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }}
    >
      I
    </Text>
  )
}

export default InterlinearMark
