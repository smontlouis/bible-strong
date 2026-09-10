import { getUniverseColor } from '~themes/universeColors'
import ResourceIcon, { type ResourceIconProps } from './icons/ResourceIcon'

const RefIcon = ({
  color = getUniverseColor('references'),
  ...props
}: Omit<ResourceIconProps, 'kind'>) => <ResourceIcon kind="references" color={color} {...props} />

export default RefIcon
