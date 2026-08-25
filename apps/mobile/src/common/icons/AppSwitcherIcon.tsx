import * as React from 'react'
import Svg, { SvgProps, Path } from 'react-native-svg'

const SvgComponent = (props: SvgProps) => (
  <Svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth={0}
    viewBox="0 0 24 24"
    height={26}
    width={26}
    {...props}
  >
    <Path
      d="M4 19h2c0 1.103.897 2 2 2h8c1.103 0 2-.897 2-2h2c1.103 0 2-.897 2-2V7c0-1.103-.897-2-2-2h-2c0-1.103-.897-2-2-2H8c-1.103 0-2 .897-2 2H4c-1.103 0-2 .897-2 2v10c0 1.103.897 2 2 2zM20 7v10h-2V7h2zM8 5h8l.001 14H8V5zM4 7h2v10H4V7z"
      stroke="none"
    />
  </Svg>
)

export default React.memo(SvgComponent)
