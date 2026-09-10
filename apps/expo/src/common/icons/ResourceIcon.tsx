import { getUniverseColor } from '~themes/universeColors'
import Svg, { Path, Rect, type SvgProps } from 'react-native-svg'
import type { Theme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'
import shapes from './resource-icon-shapes.json'

export interface ResourceIconProps extends SvgProps {
  kind: keyof typeof shapes.symbols
  size?: number
  theme?: Theme
}

const ResourceIcon = ({
  kind,
  size = 22,
  color = getUniverseColor(kind),
  theme,
  ...props
}: ResourceIconProps) => {
  const contextTheme = useTheme()
  const palette = (theme ?? contextTheme).colors
  const ink = palette[color as keyof typeof palette] || color
  const symbol = shapes.symbols[kind]

  return (
    <Svg width={size} height={size} viewBox={shapes.viewBox} fill="none" {...props}>
      <Rect {...shapes.frame} stroke={ink} strokeWidth={2} />
      <Path
        d={symbol.path}
        transform={'transform' in symbol ? symbol.transform : undefined}
        fill={ink}
      />
    </Svg>
  )
}

export default ResourceIcon
