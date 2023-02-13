import styled from '@emotion/native'

const IconButton = styled.TouchableOpacity<{
  big?: boolean
  isFlat?: boolean
  color?: any
}>(({ theme, big, isFlat, color }) => ({
  width: 40,
  height: 40,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 20,
  backgroundColor: color
    ? theme.colors[color as keyof typeof theme.colors]
    : theme.colors.reverse,

  ...(!isFlat && {
    shadowColor: theme.colors.default,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'visible',
  }),

  ...(big && {
    width: 50,
    height: 50,
    borderRadius: 25,
  }),
}))

export default IconButton
