import { getUniverseColor } from '~themes/universeColors'
import ResourceIcon, { type ResourceIconProps } from './icons/ResourceIcon'

export type CommentIconProps = Omit<ResourceIconProps, 'kind'>

const CommentIcon = ({ color = getUniverseColor('commentary'), ...props }: CommentIconProps) => (
  <ResourceIcon kind="commentary" color={color} {...props} />
)

export default CommentIcon
