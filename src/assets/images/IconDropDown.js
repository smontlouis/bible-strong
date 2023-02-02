import React, { memo } from 'react'
import Svg, { Path } from 'react-native-svg'
import { withTheme } from '@emotion/react'

const SvgComponent = ({ color, theme, ...props }) => (
  <Svg width={18} height={18} viewBox="0 0 18 18" {...props}>
    <Path
      d="M7 11l2 2 2-2H7zM7 7l2-2 2 2H7z"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      stroke={theme.colors[color]}
      fill={theme.colors[color]}
    />
  </Svg>
)

export default memo(withTheme(SvgComponent))
