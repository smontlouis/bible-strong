import styled from '@emotion/native'
import { Platform } from 'react-native'

const Mark = styled.Text<{ highlighted: boolean }>(({ highlighted, theme }) => ({
  color: highlighted ? theme.colors.primary : theme.colors.tertiary,
  fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  fontSize: 17,
  fontWeight: 'bold',
}))

const StrongMark = ({ highlighted = false }: { highlighted?: boolean }) => (
  <Mark highlighted={highlighted}>S</Mark>
)

export default StrongMark
