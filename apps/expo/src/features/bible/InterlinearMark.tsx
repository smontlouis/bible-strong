import { Platform } from 'react-native'
import Text from '~common/ui/Text'

const InterlinearMark = ({
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
    I
  </Text>
)

export default InterlinearMark
