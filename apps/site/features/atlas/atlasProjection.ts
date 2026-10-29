// The projection of the atlas map is the one the application draws its map with
// (`@bible-strong/resource-domain/biblical-map`), and the ground of `public/atlas/map.svg` is
// drawn in it by `scripts/build-atlas-map.py`.
export {
  BIBLICAL_MAP_HEIGHT as ATLAS_MAP_HEIGHT,
  BIBLICAL_MAP_HOLY_LAND as ATLAS_HOLY_LAND_VIEW,
  BIBLICAL_MAP_WHOLE as ATLAS_WHOLE_VIEW,
  BIBLICAL_MAP_WIDTH as ATLAS_MAP_WIDTH,
  projectBiblicalPlace as projectAtlasPlace,
} from '@bible-strong/resource-domain/biblical-map'
