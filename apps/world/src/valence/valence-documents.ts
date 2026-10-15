// Project documents of Valence 1876 edited in the workshop and loaded at runtime.
// Kept free of Phaser, React and story imports: the Vite dev server validates saves with it,
// and the multiplayer Worker reads the same files.
import type { NavigationSpec } from '../navigation-document'

export const VALENCE_WIDTH = 1672
export const VALENCE_HEIGHT = 941
export const VALENCE_NAVIGATION: NavigationSpec = {
  map: 'valence-1876',
  width: VALENCE_WIDTH,
  height: VALENCE_HEIGHT,
  maxObstacleRevision: 1,
}
export const STATION_IDS = ['gare', 'temple', 'maison', 'cathedrale', 'citadelle', 'champ', 'clercs', 'rhone'] as const
export const OBJECT_IDS = ['ostervald', 'signes', 'concordance', 'bost', 'sander', 'lampe', 'lettre'] as const
export type LayoutPoint = [number, number]

export type ValenceLayout = {
  version: 1
  /** Where visitors arrive: the station forecourt. */
  spawn: LayoutPoint
  /** Ground point in front of each station's characters; the dialog opens within reach. */
  stations: Record<(typeof STATION_IDS)[number], LayoutPoint>
  /** Where each station's tag floats. */
  labels: Record<(typeof STATION_IDS)[number], LayoutPoint>
  objects: Record<(typeof OBJECT_IDS)[number], LayoutPoint>
  /** The dotted thread: one polyline per pair of consecutive stations, in date order. */
  thread: LayoutPoint[][]
}

export type EffectToggle = { enabled: boolean; density: number; size: number; speed: number; opacity: number }
export type SmokeSource = { x: number; y: number; rate: number; size: number }
export type ValenceEffects = {
  version: 1
  /** The Rhône's water, where glints and current lines appear. */
  river: LayoutPoint[]
  /** Parts of the river without effects: the bridge pylon, boats, pontoons. */
  exclusions: LayoutPoint[][]
  glints: EffectToggle
  currents: EffectToggle
  smoke: SmokeSource[]
  leaves: EffectToggle
  clouds: EffectToggle
}

function point(value: unknown, margin = 0): LayoutPoint {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every(n => typeof n === 'number' && Number.isFinite(n)) ||
    value[0] < -margin ||
    value[0] > VALENCE_WIDTH + margin ||
    value[1] < -margin ||
    value[1] > VALENCE_HEIGHT + margin
  )
    throw new Error('Invalid point')
  return [Math.round(value[0] * 10) / 10, Math.round(value[1] * 10) / 10]
}

function record<K extends string>(value: unknown, keys: readonly K[]): Record<K, LayoutPoint> {
  if (!value || typeof value !== 'object') throw new Error('Invalid record')
  const raw = value as Record<string, unknown>
  return Object.fromEntries(keys.map(key => [key, point(raw[key])])) as Record<K, LayoutPoint>
}

function polyline(value: unknown, min: number, max: number, margin = 0) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error('Invalid line')
  return value.map(p => point(p, margin))
}

export function parseLayout(value: unknown): ValenceLayout {
  if (!value || typeof value !== 'object') throw new Error('Invalid layout')
  const raw = value as Record<string, unknown>
  if (raw.version !== 1 || !Array.isArray(raw.thread) || raw.thread.length !== STATION_IDS.length - 1)
    throw new Error('Incompatible layout')
  return {
    version: 1,
    spawn: point(raw.spawn),
    stations: record(raw.stations, STATION_IDS),
    labels: record(raw.labels, STATION_IDS),
    objects: record(raw.objects, OBJECT_IDS),
    thread: raw.thread.map(line => polyline(line, 2, 400)),
  }
}

function toggle(value: unknown, limits: { density: number; size: number; speed: number }): EffectToggle {
  if (!value || typeof value !== 'object') throw new Error('Invalid effect')
  const raw = value as Record<string, unknown>
  const number = (key: string, min: number, max: number) => {
    const n = raw[key]
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new Error(`Invalid ${key}`)
    return Math.round(n * 1000) / 1000
  }
  if (typeof raw.enabled !== 'boolean') throw new Error('Invalid enabled')
  return {
    enabled: raw.enabled,
    density: number('density', 0, limits.density),
    size: number('size', 0.1, limits.size),
    speed: number('speed', 0, limits.speed),
    opacity: number('opacity', 0, 1),
  }
}

export function parseEffects(value: unknown): ValenceEffects {
  if (!value || typeof value !== 'object') throw new Error('Invalid effects')
  const raw = value as Record<string, unknown>
  if (raw.version !== 1 || !Array.isArray(raw.exclusions) || raw.exclusions.length > 40 || !Array.isArray(raw.smoke) || raw.smoke.length > 24)
    throw new Error('Incompatible effects')
  return {
    version: 1,
    river: polyline(raw.river, 3, 256, 40),
    exclusions: raw.exclusions.map(zone => polyline(zone, 3, 128, 40)),
    glints: toggle(raw.glints, { density: 40, size: 4, speed: 4 }),
    currents: toggle(raw.currents, { density: 40, size: 4, speed: 4 }),
    leaves: toggle(raw.leaves, { density: 20, size: 4, speed: 4 }),
    clouds: toggle(raw.clouds, { density: 12, size: 4, speed: 4 }),
    smoke: raw.smoke.map(source => {
      if (!source || typeof source !== 'object') throw new Error('Invalid smoke')
      const s = source as Record<string, unknown>
      const [x, y] = point([s.x, s.y], 40)
      if (typeof s.rate !== 'number' || s.rate < 80 || s.rate > 10000) throw new Error('Invalid rate')
      if (typeof s.size !== 'number' || s.size < 0.2 || s.size > 4) throw new Error('Invalid size')
      return { x, y, rate: Math.round(s.rate), size: Math.round(s.size * 100) / 100 }
    }),
  }
}

export const serializeDocument = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
