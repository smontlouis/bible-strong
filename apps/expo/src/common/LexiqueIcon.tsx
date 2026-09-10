import { getUniverseColor } from '~themes/universeColors'
import ResourceIcon, { type ResourceIconProps } from './icons/ResourceIcon'

export type LexiqueIconProps = Omit<ResourceIconProps, 'kind'>

const LexiqueIcon = ({ color = getUniverseColor('strong'), ...props }: LexiqueIconProps) => (
  <ResourceIcon kind="strong" color={color} {...props} />
)

export default LexiqueIcon
