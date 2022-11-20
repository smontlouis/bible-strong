import * as React from 'react'
import { withTheme } from '@emotion/react'
import Svg, { Path } from 'react-native-svg'

function SvgComponent({ color, theme, ...props }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" {...props}>
      <Path
        fillRule="evenodd"
        fill={theme.colors[color] || theme.colors.primary}
        d="M3 17.44C3 18.3 3.9 19 5 19h3c.55 0 1-.45 1-1s-.45-1-1-1H5.25c-.14 0-.25-.11-.25-.25v-9.5c0-.14.11-.25.25-.25H8c.55 0 1-.45 1-1s-.45-1-1-1H5c-1.1 0-2 .7-2 1.56v10.88zm18 0c0 .86-.9 1.56-2 1.56h-3c-.55 0-1-.45-1-1s.45-1 1-1h2.75c.14 0 .25-.11.25-.25v-9.5c0-.14-.11-.25-.25-.25H16c-.55 0-1-.45-1-1s.45-1 1-1h3c1.1 0 2 .7 2 1.56v10.88zM13 19V5c0-.55-.45-1-1-1s-1 .45-1 1v14c0 .55.45 1 1 1s1-.45 1-1zm0 0"
      />
      <Path
        fillRule="evenodd"
        fill={theme.colors[color] || theme.colors.primary}
        d="M7 8h2c.55 0 1 .45 1 1s-.45 1-1 1H7c-.55 0-1-.45-1-1s.45-1 1-1zm8 0h2c.55 0 1 .45 1 1s-.45 1-1 1h-2c-.55 0-1-.45-1-1s.45-1 1-1zm-8 3h2c.55 0 1 .45 1 1s-.45 1-1 1H7c-.55 0-1-.45-1-1s.45-1 1-1zm8 0h2c.55 0 1 .45 1 1s-.45 1-1 1h-2c-.55 0-1-.45-1-1s.45-1 1-1zm-8 3h2c.55 0 1 .45 1 1s-.45 1-1 1H7c-.55 0-1-.45-1-1s.45-1 1-1zm8 0h2c.55 0 1 .45 1 1s-.45 1-1 1h-2c-.55 0-1-.45-1-1s.45-1 1-1zm0 0"
      />
    </Svg>
  )
}

export default withTheme(SvgComponent)
