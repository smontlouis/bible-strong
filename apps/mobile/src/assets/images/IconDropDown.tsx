import React from 'react'
import Svg, { SvgProps, Path } from 'react-native-svg'
import { withTheme } from '@emotion/react'
import { Theme } from '~themes'

interface IconDropDownProps extends SvgProps {
  color?: string
  theme?: Theme
}

const SvgComponent = ({ color, theme: themeProp, ...props }: IconDropDownProps) => {
  const theme = themeProp!
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" {...props}>
      <Path
        d="M7 11l2 2 2-2H7zM7 7l2-2 2 2H7z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        stroke={theme.colors[color as keyof typeof theme.colors]}
        fill={theme.colors[color as keyof typeof theme.colors]}
      />
    </Svg>
  )
}

export default withTheme(SvgComponent)
