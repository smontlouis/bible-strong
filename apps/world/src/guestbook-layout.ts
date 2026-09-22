/** Shared, deterministic geometry. Coordinates are centres in an unbounded world. */
export type NotePlacement = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}
export type WallBounds = { left: number; top: number; right: number; bottom: number }
export const NOTE_COLORS = ['butter', 'rose', 'mint', 'lavender', 'sky'] as const
export type NoteColor = (typeof NOTE_COLORS)[number]
export function isNoteColor(value: unknown): value is NoteColor {
  return NOTE_COLORS.includes(value as NoteColor)
}
// Explicit wrapping makes the persisted geometry independent of fonts and viewport.
// Wide Unicode characters reserve two columns; the UI uses a matching monospace font.
export function noteLines(message: string): string[] {
  return message.split('\n').flatMap(paragraph => {
    const lines: string[] = []
    let line = '',
      columns = 0
    for (const char of Array.from(paragraph)) {
      const width = char.codePointAt(0)! > 0x2ff ? 2 : 1
      if (columns + width > 24) {
        const space = line.lastIndexOf(' ')
        if (space > 0) {
          lines.push(line.slice(0, space + 1))
          line = line.slice(space + 1)
          columns = Array.from(line).reduce(
            (total, c) => total + (c.codePointAt(0)! > 0x2ff ? 2 : 1),
            0
          )
        } else {
          lines.push(line)
          line = ''
          columns = 0
        }
      }
      line += char
      columns += width
    }
    lines.push(line)
    return lines
  })
}
export function noteBounds(note: NotePlacement, gap = 0): WallBounds {
  const angle = (Math.abs(note.rotation) * Math.PI) / 180
  const w = Math.cos(angle) * note.width + Math.sin(angle) * (note.height + 20)
  const h = Math.sin(angle) * note.width + Math.cos(angle) * (note.height + 20)
  return {
    left: note.x - w / 2 - gap,
    right: note.x + w / 2 + gap,
    top: note.y - h / 2 - gap,
    bottom: note.y + h / 2 + gap,
  }
}
export function overlaps(a: WallBounds, b: WallBounds) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}
export function placeNote(id: string, message: string, existing: NotePlacement[]): NotePlacement {
  const hash = Array.from(id).reduce((value, c) => (value * 31 + c.charCodeAt(0)) >>> 0, 0)
  const note = {
    x: 0,
    y: 0,
    width: 264,
    height: 100 + noteLines(message).length * 23,
    rotation: (hash % 13) - 6,
  }
  // Bucket occupied bounds so a candidate only checks nearby notes.
  const buckets = new Map<string, WallBounds[]>()
  function cells(bounds: WallBounds) {
    const keys: string[] = []
    for (let x = Math.floor(bounds.left / 320); x <= Math.floor(bounds.right / 320); x++)
      for (let y = Math.floor(bounds.top / 320); y <= Math.floor(bounds.bottom / 320); y++)
        keys.push(`${x}:${y}`)
    return keys
  }
  for (const other of existing) {
    const bounds = noteBounds(other, 16)
    for (const key of cells(bounds)) {
      const bucket = buckets.get(key) ?? []
      bucket.push(bounds)
      buckets.set(key, bucket)
    }
  }
  // Expanding rings always terminate: a finite collection leaves free space outside it.
  for (let radius = 0; ; radius += 32) {
    const steps = radius === 0 ? 1 : Math.ceil((2 * Math.PI * radius) / 32)
    for (let step = 0; step < steps; step++) {
      const angle = (step / steps) * 2 * Math.PI + ((hash % 360) * Math.PI) / 180
      note.x = Math.round(Math.cos(angle) * radius)
      note.y = Math.round(Math.sin(angle) * radius)
      const candidate = noteBounds(note)
      if (
        !cells(candidate).some(key => buckets.get(key)?.some(bounds => overlaps(candidate, bounds)))
      )
        return note
    }
  }
}
export function wallBounds(notes: NotePlacement[], margin = 64): WallBounds {
  const bounds = notes.length
    ? notes.map(note => noteBounds(note))
    : [{ left: -160, right: 160, top: -120, bottom: 120 }]
  return {
    left: Math.min(...bounds.map(b => b.left)) - margin,
    right: Math.max(...bounds.map(b => b.right)) + margin,
    top: Math.min(...bounds.map(b => b.top)) - margin,
    bottom: Math.max(...bounds.map(b => b.bottom)) + margin,
  }
}
export type WallCamera = { x: number; y: number; zoom: number }
export function minimumZoom(bounds: WallBounds, width: number, height: number) {
  return Math.min(1, width / (bounds.right - bounds.left), height / (bounds.bottom - bounds.top))
}
export function constrainCamera(
  camera: WallCamera,
  bounds: WallBounds,
  width: number,
  height: number
): WallCamera {
  const zoom = Math.max(minimumZoom(bounds, width, height), Math.min(2, camera.zoom))
  const axis = (value: number, min: number, max: number, half: number) =>
    max - min <= half * 2 ? (min + max) / 2 : Math.max(min + half, Math.min(max - half, value))
  return {
    zoom,
    x: axis(camera.x, bounds.left, bounds.right, width / zoom / 2),
    y: axis(camera.y, bounds.top, bounds.bottom, height / zoom / 2),
  }
}
