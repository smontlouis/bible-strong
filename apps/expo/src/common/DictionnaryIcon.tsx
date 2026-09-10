import { getUniverseColor } from '~themes/universeColors'
import ResourceIcon, { type ResourceIconProps } from './icons/ResourceIcon'

export type DictionnaryIconProps = Omit<ResourceIconProps, 'kind'>

const DictionnaryIcon = ({
  color = getUniverseColor('dictionary'),
  ...props
}: DictionnaryIconProps) => <ResourceIcon kind="dictionary" color={color} {...props} />

export default DictionnaryIcon
