import styled from '@emotion/native'

import Text from './Text'

const Paragraph = styled(Text)(({ small }) => ({
  fontFamily: 'literata-book',
  fontSize: small ? 14 : 20,
  lineHeight: small ? 22 : 34
}))

export default Paragraph
