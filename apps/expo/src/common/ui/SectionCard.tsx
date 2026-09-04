import styled from '@emotion/native'
import Box from '~common/ui/Box'

const SectionCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
  borderRadius: 16,
  marginHorizontal: 20,
  marginBottom: 16,
}))

export const SectionCardHeader = styled(Box)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: theme.colors.opacity5,
}))

export default SectionCard
