import ResourceIcon from '~common/icons/ResourceIcon'
import { useTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors } from '~themes/universeColors'
import { FeatherIcon } from './Icon'
import IconTile from './IconTile'

export type ResourceTileKind =
  | 'strong'
  | 'dictionary'
  | 'nave'
  | 'commentary'
  | 'references'
  | 'timeline'

/** The mark of a study resource: the same icon and colours wherever an item of it appears. */
const ResourceTile = ({ kind, size = 18 }: { kind: ResourceTileKind; size?: number }) => {
  const theme = useTheme()
  const { background, foreground } = resolveUniverseColors(theme.colors, kind)
  return (
    <IconTile bg={background}>
      {kind === 'timeline' ? (
        <FeatherIcon name="clock" size={size} color={foreground} />
      ) : (
        <ResourceIcon kind={kind} size={size} color={foreground} />
      )}
    </IconTile>
  )
}

export default ResourceTile
