import styled from '@emotion/native'
import Box from '~common/ui/Box'

// @ts-ignore
const SectionTitle = styled(Box)(({ theme, color }: any) => ({
  fontSize: 20,
  marginLeft: 20,
  marginTop: 10,
  height: 30,
  width: 30,
  borderRadius: 15,
  // @ts-ignore
  backgroundColor: theme.colors[color],
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'visible',
}))

export default SectionTitle
