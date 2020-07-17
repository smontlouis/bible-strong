import React from 'react'
import { withTheme } from 'emotion-theming'
import Svg, { G, Path } from 'react-native-svg'
/* SVGR has dropped some elements not supported by react-native-svg: title */

const SvgComponent = ({ color, theme, size = 22, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 18 22" {...props}>
    <G fill="none" fillRule="evenodd">
      <Path
        d="M1 18.5A2.5 2.5 0 013.5 16H17"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.5 1H17v20H3.5A2.5 2.5 0 011 18.5v-15A2.5 2.5 0 013.5 1z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.53 14.17c.698 0 1.308-.11 1.832-.334a3.784 3.784 0 001.292-.872c.338-.357.585-.722.742-1.093.157-.372.236-.717.236-1.036 0-.25-.087-.46-.26-.629a.86.86 0 00-.622-.253c-.283 0-.488.083-.615.25a2.163 2.163 0 00-.322.646c-.205.56-.509.985-.912 1.275-.403.289-.897.434-1.48.434-.538 0-1.007-.128-1.408-.383s-.711-.642-.93-1.159c-.219-.517-.328-1.165-.328-1.945 0-1.166.247-2.066.742-2.7.494-.633 1.158-.95 1.992-.95.524 0 .965.123 1.323.369s.669.618.933 1.114c.16.301.304.513.434.636s.325.185.585.185a.78.78 0 00.594-.267.88.88 0 00.246-.615c0-.424-.168-.874-.505-1.35-.338-.477-.823-.876-1.456-1.2-.634-.324-1.356-.485-2.167-.485a4.98 4.98 0 00-1.88.355c-.588.237-1.1.582-1.538 1.036-.438.453-.774.999-1.009 1.637-.234.638-.352 1.36-.352 2.167 0 .497.047.966.14 1.408.094.442.234.858.42 1.248.188.39.413.741.678 1.056.296.346.62.625.974.837.353.212.746.368 1.179.469.433.1.914.15 1.442.15z"
        fill={color}
        fillRule="nonzero"
      />
    </G>
  </Svg>
)

export default withTheme(SvgComponent)
