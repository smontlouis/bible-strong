import * as React from 'react'
import Svg, { Path } from 'react-native-svg'
import { withTheme } from 'emotion-theming'
import { Theme } from '~themes'

function SvgComponent({
  color,
  theme,
  size = 80,
  ...props
}: {
  color?: string
  size?: number
  theme: Theme
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 80" {...props}>
      <Path
        fill={theme.colors[color] || color || theme.colors.reverse}
        d="M56.5 30c-2.8 0-5.2 2.2-5.5 5H37.5c0-3-2.5-5.5-5.5-5.5S26.5 32 26.5 35H20v-2h-2v2h-5c-.3-3-3-5.3-6-5s-5.3 3-5 6 3 5.3 6 5c2.3-.2 4.2-1.8 4.8-4h13.9c.8 2.9 3.8 4.6 6.8 3.8 1.9-.5 3.3-2 3.8-3.8H44v1h2v-1h5.2c.8 2.9 3.9 4.6 6.8 3.8s4.6-3.9 3.8-6.8c-.7-2.4-2.8-4-5.3-4zm-49 9C5.6 39 4 37.4 4 35.5S5.6 32 7.5 32s3.5 1.6 3.5 3.5S9.4 39 7.5 39zm24.5-.2c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm24.5.2c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"
      />
      <Path
        fill={theme.colors[color] || color || theme.colors.reverse}
        d="M18 29h2v2h-2zM18 25h2v2h-2zM18 21h2v2h-2zM44 44h2v2h-2zM44 40h2v2h-2zM10 19h18c.6 0 1-.4 1-1v-8c0-.6-.4-1-1-1H10c-.6 0-1 .4-1 1v8c0 .6.4 1 1 1zm1-8h16v6H11v-6z"
      />
      <Path
        fill={theme.colors[color] || color || theme.colors.reverse}
        d="M13 13h2v2h-2zM17 13h8v2h-8zM54 49h-8v-1h-2v1h-8c-.6 0-1 .4-1 1v8c0 .6.4 1 1 1h18c.6 0 1-.4 1-1v-8c0-.6-.4-1-1-1zm-1 8H37v-6h16v6z"
      />
      <Path
        fill={theme.colors[color] || color || theme.colors.reverse}
        d="M39 53h8v2h-8zM49 53h2v2h-2z"
      />
    </Svg>
  )
}

export default withTheme(SvgComponent)
