import { getUniverseColor } from '~themes/universeColors'
import ResourceIcon, { type ResourceIconProps } from './icons/ResourceIcon'

export type NaveIconProps = Omit<ResourceIconProps, 'kind'>

const NaveIcon = ({ color = getUniverseColor('nave'), ...props }: NaveIconProps) => (
  <ResourceIcon kind="nave" color={color} {...props} />
)

export default NaveIcon
