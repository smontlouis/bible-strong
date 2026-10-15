import type { ReaderManifest } from '../animated-reader'

/** A soft contact shadow under one figure, in map units (scripts/valence/build_scene_shadows.py). */
export type SceneShadow = { x: number; y: number; rx: number; ry: number }
export type SceneManifest = ReaderManifest & {
  id: string
  mode: 'sprite' | 'patch'
  frameCount: number
  shadows?: SceneShadow[]
}

// Built offline by scripts/valence/build_scene_atlas.py from MiniMax videos and SAM 3 masks.
const manifests = import.meta.glob<SceneManifest>('./generated/scenes/*.json', {
  eager: true,
  import: 'default',
})

export const valenceScenes = Object.values(manifests)
  .map(manifest => ({ id: manifest.id, manifest }))
  .sort((a, b) => a.manifest.depth - b.manifest.depth)
