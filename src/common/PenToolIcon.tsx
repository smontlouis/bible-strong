import React from 'react'
import Svg, { SvgProps, Path, Circle } from 'react-native-svg'

const SvgComponent = ({
  color = 'black',
  ...props
}: { color?: string } & Omit<SvgProps, 'color'>) => (
  <Svg
    width={22}
    height={22}
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Path d="M12 19l7-7 3 3-7 7-3-3z" />
    <Path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586" />
    <Circle cx={11} cy={11} r={2} />
  </Svg>
)

export default SvgComponent
