import styled from '@emotion/native'
import { Feather } from '@expo/vector-icons'
import type { ComponentProps } from 'react'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'

interface SectionHeaderProps {
  icon: ComponentProps<typeof Feather>['name']
  title: string
}

const SectionHeader = ({ icon, title }: SectionHeaderProps) => (
  <Container>
    <FeatherIcon name={icon} size={16} color="grey" />
    <Title>{title}</Title>
  </Container>
)

const Container = styled(Box)(() => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingTop: 20,
  paddingBottom: 8,
  gap: 8,
}))

const Title = styled(Text)(({ theme }) => ({
  fontSize: 12,
  fontWeight: '600',
  color: theme.colors.grey,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}))

export default SectionHeader
