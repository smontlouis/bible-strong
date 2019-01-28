import styled from '@emotion/native'
import { Platform } from 'react-native'

import Text from './Text'

const Paragraph = styled(Text)(() => ({
  fontFamily: Platform.OS === 'ios' ? 'System' : 'serif',
  fontSize: 18,
  lineHeight: 27
}))

export default Paragraph
