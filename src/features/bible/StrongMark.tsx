import { Platform } from 'react-native'
import Text from '~common/ui/Text'

const StrongMark = ({
  highlighted = false,
  passive = false,
}: {
  highlighted?: boolean
  passive?: boolean
}) => (
  <Text
    color={passive ? 'default' : highlighted ? 'primary' : 'tertiary'}
    fontSize={17}
    bold
    style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }}
  >
    S
  </Text>
)

export default StrongMark
