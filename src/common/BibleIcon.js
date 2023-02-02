import React, { memo } from 'react'
import Svg, { G, Path } from 'react-native-svg'
/* SVGR has dropped some elements not supported by react-native-svg: title */

const SvgComponent = props => (
  <Svg width={24} height={23} {...props}>
    <G
      stroke="#000"
      strokeWidth={2}
      fill="none"
      fillRule="evenodd"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M4 3h4a4 4 0 014 4v12.302S10.657 18 9 18H4a2 2 0 01-2-2V5a2 2 0 012-2zM20 3h-4 0a4 4 0 00-4 4v12.302S13.167 18 14.635 18H20a2 2 0 002-2V5a2 2 0 00-2-2z" />
    </G>
  </Svg>
)

export default memo(SvgComponent)
