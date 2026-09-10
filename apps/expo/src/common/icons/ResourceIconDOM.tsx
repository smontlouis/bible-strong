import shapes from './resource-icon-shapes.json'

const ResourceIconDOM = ({
  kind,
  size = 22,
  color = 'currentColor',
}: {
  kind: keyof typeof shapes.symbols
  size?: number
  color?: string
}) => {
  const symbol = shapes.symbols[kind]
  return (
    <svg width={size} height={size} viewBox={shapes.viewBox} fill="none" aria-hidden="true">
      <rect {...shapes.frame} stroke={color} strokeWidth={2} />
      <path
        d={symbol.path}
        transform={'transform' in symbol ? symbol.transform : undefined}
        fill={color}
        stroke="none"
      />
    </svg>
  )
}

export default ResourceIconDOM
