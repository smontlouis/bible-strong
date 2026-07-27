import { Platform } from 'react-native'
import Text from '~common/ui/Text'

const InterlinearMark = ({
  highlighted = false,
  originalLanguage,
}: {
  highlighted?: boolean
  originalLanguage?: 'hebrew' | 'greek'
}) => (
  <Text
    color={highlighted ? 'primary' : 'tertiary'}
    fontSize={17}
    bold
    style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }}
  >
    {originalLanguage === 'hebrew' ? 'א' : originalLanguage === 'greek' ? 'α' : 'I'}
  </Text>
)

export default InterlinearMark
