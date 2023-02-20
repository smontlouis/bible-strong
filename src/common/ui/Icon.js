import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'

import Text from '~common/ui/Text'

export const FeatherIcon = styled(Icon.Feather)(
  ({ theme, color = 'default' }) => ({
    color: theme.colors[color] || color || theme.colors.default,
  })
)

export const IonIcon = styled(Icon.Ionicons)(
  ({ theme, color = 'default' }) => ({
    color: theme.colors[color] || color || theme.colors.default,
  })
)

export const MaterialIcon = styled(Icon.MaterialIcons)(({ theme, color }) => ({
  color: theme.colors[color] || color || theme.colors.default,
}))

export const TextIcon = styled(Text)(({ color, theme }) => ({
  fontSize: 16,
  fontWeight: 'bold',
  marginRight: 5,
  color: theme.colors[color] || theme.colors.default,
}))
