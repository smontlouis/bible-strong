export const ambientKinds = ['particles', 'butterfly', 'light', 'dragonfly'] as const
export type AmbientKind = (typeof ambientKinds)[number]
export type AmbientZone = {
  id: string
  name: string
  kind: AmbientKind
  x: number
  y: number
  width: number
  height: number
  count: number
  size: number
  speed: number
  intensity: number
  glow?: number
  color: string
  style: 'round' | 'leaf' | 'petal' | 'sparkle' | 'glow' | 'lantern'
  phase: number
  enabled: boolean
}
export function parseAmbientZones(value: unknown): AmbientZone[] {
  if (!Array.isArray(value) || value.length > 80) throw new Error('Invalid ambient zones')
  const ids = new Set<string>()
  let total = 0
  return value.map(raw => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid ambient zone')
    const z = raw as AmbientZone
    if (
      typeof z.id !== 'string' ||
      !z.id ||
      z.id.length > 100 ||
      ids.has(z.id) ||
      typeof z.name !== 'string' ||
      z.name.length > 100 ||
      !ambientKinds.includes(z.kind) ||
      typeof z.enabled !== 'boolean' ||
      !/^#[0-9a-f]{6}$/i.test(z.color) ||
      !['round', 'leaf', 'petal', 'sparkle', 'glow', 'lantern'].includes(z.style) ||
      !Number.isInteger(z.count) ||
      z.count < 1 ||
      z.count > (z.kind === 'particles' ? 64 : z.kind === 'light' ? 1 : 12) ||
      !Number.isFinite(z.x) ||
      Math.abs(z.x) > 10000 ||
      !Number.isFinite(z.y) ||
      Math.abs(z.y) > 10000 ||
      !Number.isFinite(z.width) ||
      z.width < 12 ||
      z.width > 1200 ||
      !Number.isFinite(z.height) ||
      z.height < 12 ||
      z.height > 1200 ||
      !Number.isFinite(z.size) ||
      z.size < 0.25 ||
      z.size > 4 ||
      !Number.isFinite(z.speed) ||
      z.speed < 0.1 ||
      z.speed > 4 ||
      !Number.isFinite(z.intensity) ||
      z.intensity < (z.kind === 'particles' ? 0 : 0.05) ||
      z.intensity > 1 ||
      (z.glow !== undefined && (!Number.isFinite(z.glow) || z.glow < 0 || z.glow > 1)) ||
      !Number.isFinite(z.phase) ||
      Math.abs(z.phase) > 1000
    )
      throw new Error('Invalid ambient zone')
    ids.add(z.id)
    total += z.count
    if (total > 600) throw new Error('Too many ambient objects')
    return {
      id: z.id,
      name: z.name,
      kind: z.kind,
      x: z.x,
      y: z.y,
      width: z.width,
      height: z.height,
      count: z.count,
      size: z.size,
      speed: z.speed,
      intensity: z.intensity,
      ...(z.glow === undefined ? {} : { glow: z.glow }),
      color: z.color,
      style: z.style,
      phase: z.phase,
      enabled: z.enabled,
    }
  })
}
export function newAmbientZone(
  kind: AmbientKind,
  bounds: Pick<AmbientZone, 'x' | 'y' | 'width' | 'height'>
): AmbientZone {
  return {
    id: crypto.randomUUID(),
    name: '',
    kind,
    ...bounds,
    count: kind === 'particles' ? 8 : kind === 'light' ? 1 : 3,
    size: 1,
    speed: 1,
    intensity: kind === 'light' ? 0.6 : 0.8,
    color:
      kind === 'particles'
        ? '#c1a0ff'
        : kind === 'light'
          ? '#ffd671'
          : kind === 'dragonfly'
            ? '#b9eee5'
            : '#ffe9af',
    style: kind === 'light' ? 'glow' : 'round',
    phase: 0,
    enabled: true,
  }
}
const DRAFT = 'bible-strong-ambient-zones-draft-v1'
export function createAmbientEditor() {
  let saved = '[]'
  const listeners = new Set<() => void>(),
    history: AmbientZone[][] = []
  const model = {
    zones: [] as AmbientZone[],
    kind: 'particles' as AmbientKind,
    selected: '',
    editing: false,
    mode: 'select' as 'select' | 'draw' | 'pan',
    guides: true,
    focus: 0,
    revision: 0,
    loaded: false,
    saving: false,
    error: false,
    get dirty() {
      return JSON.stringify(model.zones) !== saved
    },
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    notify() {
      listeners.forEach(fn => fn())
    },
    checkpoint() {
      history.push(structuredClone(model.zones))
      if (history.length > 40) history.shift()
    },
    commit() {
      model.revision++
      try {
        localStorage.setItem(DRAFT, JSON.stringify({ base: saved, zones: model.zones }))
      } catch {
        /* Project saves remain available. */
      }
      model.notify()
    },
    async load() {
      try {
        const response = await fetch('./ambience/archipelago.json', { cache: 'no-store' })
        if (!response.ok) throw new Error('Load failed')
        model.zones = parseAmbientZones(await response.json())
        saved = JSON.stringify(model.zones)
        try {
          const draft = JSON.parse(
            (import.meta.env.DEV ? localStorage.getItem(DRAFT) : null) ?? 'null'
          )
          if (draft?.base === saved) model.zones = parseAmbientZones(draft.zones)
        } catch {
          /* Use project data. */
        }
        model.selected = model.zones.find(z => z.kind === model.kind)?.id ?? ''
        model.loaded = true
        model.error = false
        model.revision++
      } catch {
        model.error = true
      }
      model.notify()
    },
    async saveProject() {
      if (!import.meta.env.DEV) return
      if (!model.loaded || model.saving) return
      model.saving = true
      model.error = false
      model.notify()
      const snapshot = JSON.stringify(model.zones)
      try {
        parseAmbientZones(model.zones)
        const response = await fetch('/__study-world/ambience', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: snapshot,
        })
        if (!response.ok) throw new Error('Save failed')
        saved = snapshot
        try {
          if (!model.dirty) localStorage.removeItem(DRAFT)
          else localStorage.setItem(DRAFT, JSON.stringify({ base: saved, zones: model.zones }))
        } catch {
          /* Saved on disk. */
        }
      } catch {
        model.error = true
      } finally {
        model.saving = false
        model.notify()
      }
    },
    change(patch: Partial<AmbientZone>) {
      const next = model.zones.map(z => (z.id === model.selected ? { ...z, ...patch } : z))
      try {
        parseAmbientZones(next)
      } catch {
        model.error = true
        model.notify()
        return
      }
      model.checkpoint()
      model.zones = next
      model.commit()
    },
    add(bounds: Pick<AmbientZone, 'x' | 'y' | 'width' | 'height'>) {
      const zone = newAmbientZone(model.kind, bounds)
      try {
        parseAmbientZones([...model.zones, zone])
      } catch {
        model.error = true
        model.notify()
        return
      }
      model.checkpoint()
      model.zones = [...model.zones, zone]
      model.selected = zone.id
      model.mode = 'select'
      model.commit()
    },
    remove() {
      model.checkpoint()
      model.zones = model.zones.filter(z => z.id !== model.selected)
      model.selected = model.zones.find(z => z.kind === model.kind)?.id ?? ''
      model.commit()
    },
    undo() {
      const previous = history.pop()
      if (previous) {
        model.zones = previous
        model.selected = previous.find(z => z.kind === model.kind)?.id ?? ''
        model.commit()
      }
    },
  }
  return model
}
export type AmbientEditorModel = ReturnType<typeof createAmbientEditor>
