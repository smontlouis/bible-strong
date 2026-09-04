import React from 'react'
import Svg, { Ellipse, G } from 'react-native-svg'

interface CircleSketchIconProps {
  color?: string
  width?: number
  height?: number
}

const CircleSketchIcon = ({ color = '#000', width = 20, height = 20 }: CircleSketchIconProps) => (
  <Svg width={width} height={height} viewBox="0 0 24 24">
    <G fill="none">
      {/* Thicker ellipse */}
      <Ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="7"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity={0.7}
        transform="rotate(-2 12 12)"
        fill="transparent"
      />
      {/* Thinner ellipse */}
      <Ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="10"
        stroke={color}
        strokeWidth="0.5"
        strokeOpacity={0.9}
        transform="rotate(90 12 12)"
        fill="transparent"
      />
    </G>
  </Svg>
)

export default CircleSketchIcon
