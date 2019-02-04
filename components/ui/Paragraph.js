import styled from '@emotion/native'
import { Platform } from 'react-native'

import Text from './Text'

const Paragraph = styled(Text)(({ small }) => ({
  fontFamily: Platform.OS === 'ios' ? 'System' : 'serif',
  fontSize: small ? 14 : 18,
  lineHeight: small ? 20 : 27
}))

export default Paragraph
