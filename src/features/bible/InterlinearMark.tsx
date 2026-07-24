import { Platform } from 'react-native'
import Text from '~common/ui/Text'

const InterlinearMark = ({ highlighted = false }: { highlighted?: boolean }) => (
  <Text
    color={highlighted ? 'primary' : 'tertiary'}
    fontSize={17}
    bold
    style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }}
  >
    I
  </Text>
)

export default InterlinearMark
