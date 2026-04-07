import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'

import Text from '~common/ui/Text'

interface IconStyleProps {
  color?: string
}

export const FeatherIcon = styled(Icon.Feather)<IconStyleProps>(({ theme, color = 'default' }) => ({
  color: theme.colors[color as keyof typeof theme.colors] || color || theme.colors.default,
}))

export const IonIcon = styled(Icon.Ionicons)<IconStyleProps>(({ theme, color = 'default' }) => ({
  color: theme.colors[color as keyof typeof theme.colors] || color || theme.colors.default,
}))

export const MaterialIcon = styled(Icon.MaterialIcons)<IconStyleProps>(({ theme, color }) => ({
  color: theme.colors[color as keyof typeof theme.colors] || color || theme.colors.default,
}))

export const TextIcon = styled(Text)<IconStyleProps>(({ color, theme }) => ({
  fontSize: 16,
  fontWeight: 'bold',
  marginRight: 5,
  color: theme.colors[color as keyof typeof theme.colors] || theme.colors.default,
}))
