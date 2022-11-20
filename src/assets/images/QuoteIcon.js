import React from 'react'
import Svg, { Path } from 'react-native-svg'
import { withTheme } from '@emotion/react'

const SvgComponent = ({ theme, color, ...props }) => (
  <Svg width={20} height={20} viewBox="0 0 18 18" {...props}>
    <Path
      d="M4 5h3v3H4zM11 5h3v3h-3z"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      stroke={theme.colors[color]}
      fill={theme.colors[color]}
    />
    <Path
      d="M7 8c0 4.031-3 5-3 5M14 8c0 4.031-3 5-3 5"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      stroke={theme.colors[color]}
      fill={theme.colors[color]}
    />
  </Svg>
)

export default withTheme(SvgComponent)
