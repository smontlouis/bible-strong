export type ShorePoint = [number, number]
export type Shoreline = {
  id: string
  points: ShorePoint[]
  closed: boolean
  side: number
  width: number
  period: number
  strength: number
}
const STORAGE_KEY = 'bible-strong-shorelines-v1'
const DRAFT_KEY = 'bible-strong-shorelines-draft-v2'
export function parseShorelines(value: unknown): Shoreline[] {
  if (!Array.isArray(value) || value.length > 80) throw new Error('Invalid shorelines')
  return value.map(line => {
    if (
      !line ||
      typeof line.id !== 'string' ||
      typeof line.closed !== 'boolean' ||
      !Array.isArray(line.points) ||
      line.points.length < 2 ||
      line.points.length > 256 ||
      !line.points.every(
        (p: unknown) =>
          Array.isArray(p) &&
          p.length === 2 &&
          p.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 10000)
      ) ||
      ![1, -1].includes(line.side) ||
      !Number.isFinite(line.width) ||
      line.width < 4 ||
      line.width > 40 ||
      !Number.isFinite(line.period) ||
      line.period < 2 ||
      line.period > 8 ||
      !Number.isFinite(line.strength) ||
      line.strength < 0.1 ||
      line.strength > 0.85
    )
      throw new Error('Invalid shoreline')
    return {
      id: line.id,
      points: line.points,
      closed: line.closed,
      side: line.side,
      width: line.width,
      period: line.period,
      strength: line.strength,
    }
  })
}
export function createShoreEditor() {
  let lines: Shoreline[] = []
  let saveError = false
  try {
    if (import.meta.env.DEV)
      lines = parseShorelines(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
  } catch {
    saveError = true
  }
  let saved = JSON.stringify([])
  const listeners = new Set<() => void>()
  const history: Shoreline[][] = []
  const model = {
    lines,
    editing: false,
    mode: 'pan' as 'pan' | 'draw' | 'edit',
    selected: lines[0]?.id ?? '',
    guides: true,
    paused: false,
    focus: 0,
    revision: 0,
    saveError,
    loaded: false,
    saving: false,
    get dirty() {
      return JSON.stringify(model.lines) !== saved
    },
    async load() {
      try {
        const response = await fetch('./shorelines/archipelago.json', { cache: 'no-store' })
        if (!response.ok) throw new Error('Cannot load shorelines')
        const project = parseShorelines(await response.json())
        saved = JSON.stringify(project)
        // Recover a draft only if its base still matches the project file.
        let recovered: Shoreline[] | undefined
        try {
          const draft = JSON.parse(
            (import.meta.env.DEV ? localStorage.getItem(DRAFT_KEY) : null) ?? 'null'
          )
          if (draft?.base === saved) recovered = parseShorelines(draft.lines)
          else if (!draft && lines.length) recovered = lines
        } catch {
          /* The project file remains authoritative. */
        }
        model.lines = recovered ?? project
        model.selected = model.lines[0]?.id ?? ''
        model.loaded = true
        model.saveError = false
        model.revision++
      } catch {
        model.saveError = true
      }
      model.notify()
    },
    async saveProject() {
      if (!import.meta.env.DEV) return
      if (!model.loaded || model.saving) return
      const snapshot = JSON.stringify(model.lines)
      model.saving = true
      model.saveError = false
      model.notify()
      try {
        const response = await fetch('/__study-world/shorelines', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: snapshot,
        })
        if (!response.ok) throw new Error('Cannot save shorelines')
        saved = snapshot
        try {
          localStorage.removeItem(STORAGE_KEY)
          if (!model.dirty) localStorage.removeItem(DRAFT_KEY)
          else localStorage.setItem(DRAFT_KEY, JSON.stringify({ base: saved, lines: model.lines }))
        } catch {
          /* A successful project save does not depend on browser storage. */
        }
      } catch {
        model.saveError = true
      } finally {
        model.saving = false
        model.notify()
      }
    },
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    notify() {
      for (const fn of listeners) fn()
    },
    checkpoint() {
      history.push(structuredClone(model.lines))
      if (history.length > 40) history.shift()
    },
    save() {
      model.revision++
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ base: saved, lines: model.lines }))
        model.saveError = false
      } catch {
        model.saveError = true
      }
      model.notify()
    },
    undo() {
      const old = history.pop()
      if (old) {
        model.lines = old
        model.selected = old.at(-1)?.id ?? ''
        model.save()
      }
    },
    change(patch: Partial<Shoreline>) {
      model.checkpoint()
      model.lines = model.lines.map(line =>
        line.id === model.selected ? { ...line, ...patch } : line
      )
      model.save()
    },
    add(points: ShorePoint[]) {
      if (model.lines.length >= 80) return
      model.checkpoint()
      const line = {
        id: crypto.randomUUID(),
        points,
        closed: false,
        side: 1,
        width: 17,
        period: 3,
        strength: 0.45,
      }
      model.lines = [...model.lines, line]
      model.selected = line.id
      model.save()
    },
    remove() {
      model.checkpoint()
      model.lines = model.lines.filter(line => line.id !== model.selected)
      model.selected = model.lines.at(-1)?.id ?? ''
      model.save()
    },
  }
  return model
}
export type ShoreEditorModel = ReturnType<typeof createShoreEditor>

export function simplify(points: ShorePoint[], tolerance = 1.1): ShorePoint[] {
  if (points.length <= 2) return points.map(p => [...p])
  const a = points[0],
    b = points[points.length - 1],
    dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = dx * dx + dy * dy
  let max = 0,
    index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i],
      t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0
    const distance = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
    if (distance > max) {
      max = distance
      index = i
    }
  }
  if (max <= tolerance) return [[...a], [...b]]
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ]
}
export function prepareShore(points: ShorePoint[], closed = false) {
  if (points.length < 2) return []
  let curve = points.map(p => [...p] as ShorePoint)
  for (let round = 0; round < 3; round++) {
    const next: ShorePoint[] = closed ? [] : [curve[0]]
    for (let i = 0; i < curve.length - (closed ? 0 : 1); i++) {
      const a = curve[i],
        b = curve[(i + 1) % curve.length]
      next.push(
        [0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]],
        [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]
      )
    }
    if (!closed) next.push(curve[curve.length - 1])
    curve = next
  }
  if (closed) curve.push(curve[0])
  const lengths = [0]
  for (let i = 1; i < curve.length; i++)
    lengths.push(
      lengths[i - 1] + Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1])
    )
  const total = lengths[lengths.length - 1]
  if (total < 1) return []
  const count = Math.min(400, Math.max(12, Math.ceil(total / 2)))
  const result: {
    x: number
    y: number
    distance: number
    total: number
    nx: number
    ny: number
  }[] = []
  let segment = 1
  for (let i = 0; i <= count; i++) {
    const distance = (total * i) / count
    while (segment < curve.length - 1 && lengths[segment] < distance) segment++
    const a = curve[segment - 1],
      b = curve[segment],
      t = (distance - lengths[segment - 1]) / (lengths[segment] - lengths[segment - 1] || 1)
    result.push({
      x: a[0] + (b[0] - a[0]) * t,
      y: a[1] + (b[1] - a[1]) * t,
      distance,
      total,
      nx: 0,
      ny: 0,
    })
  }
  for (let i = 0; i < result.length; i++) {
    const a = result[i === 0 ? (closed ? result.length - 2 : 0) : i - 1],
      b = result[i === result.length - 1 ? (closed ? 1 : i) : i + 1]
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    result[i].nx = -(b.y - a.y) / length
    result[i].ny = (b.x - a.x) / length
  }
  return result
}
