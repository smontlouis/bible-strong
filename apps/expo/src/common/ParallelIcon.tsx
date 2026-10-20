import * as React from 'react'
import { withTheme } from '~themes/ThemeProvider'
import Svg, { Line, Rect, SvgProps } from 'react-native-svg'
import { Theme } from '~themes'

// Two columns side by side: a rounded frame split down the middle.
function SvgComponent({ color, theme, ...props }: { color?: string; theme: Theme } & SvgProps) {
  const iconColor =
    (color ? theme.colors[color as keyof typeof theme.colors] : undefined) || theme.colors.primary

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" {...props}>
      <Rect x={3} y={4.5} width={18} height={15} rx={4.5} stroke={iconColor} strokeWidth={2} />
      <Line
        x1={12}
        y1={4.5}
        x2={12}
        y2={19.5}
        stroke={iconColor}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  )
}

export default React.memo(withTheme(SvgComponent))
