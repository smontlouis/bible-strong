import React from 'react'
import Svg, { Path } from 'react-native-svg'
import { withTheme } from '@emotion/react'

const SvgComponent = ({ color, theme, ...props }) => (
  <Svg width={20} height={20} viewBox="0 0 18 18" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      stroke={color || 'black'}
      fill="none"
      d="M3 15h12"
    />
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      stroke={color || theme.colors.primary}
      fill="none"
      d="M5.5 11L9 3l3.5 8M11.63 9H6.38"
    />
  </Svg>
)

export default withTheme(SvgComponent)
