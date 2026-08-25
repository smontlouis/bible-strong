import styled from '@emotion/native'
import { Theme } from '@emotion/react'
import Box from '~common/ui/Box'

interface IconCircleProps {
  bg?: string
  size?: number
}

const IconCircle = styled(Box)<IconCircleProps>(
  ({ theme, bg, size = 36 }: { theme: Theme; bg?: string; size?: number }) => ({
    width: size,
    height: size,
    borderRadius: 10,
    backgroundColor: bg
      ? theme.colors[bg as keyof typeof theme.colors] || bg
      : theme.colors.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  })
)

export default IconCircle
