import { afterEach, describe, expect, it, vi } from 'vitest'
import defaults from './ambient-defaults.json'
import { createAmbientEditor, newAmbientZone, parseAmbientZones } from './ambient-zones'

afterEach(() => vi.unstubAllGlobals())
function storage() {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
  return data
}
describe('editable ambient documents', () => {
  it('loads all existing ambience kinds and rejects invalid geometry and excessive counts', () => {
    const zones = parseAmbientZones(defaults)
    expect(new Set(zones.map(z => z.kind))).toEqual(
      new Set(['particles', 'butterfly', 'dragonfly', 'light'])
    )
    const zone = zones.find(z => z.kind === 'particles')!
    for (const patch of [
      { count: 1000 },
      { glow: -1 },
      { glow: 2 },
      { size: NaN },
      { color: 'red' },
      { width: 0 },
      { speed: 0 },
    ])
      expect(() => parseAmbientZones([{ ...zone, ...patch }])).toThrow()
    expect(() => parseAmbientZones([zone, zone])).toThrow()
    expect(() =>
      parseAmbientZones(
        Array.from({ length: 10 }, (_, i) => ({ ...zone, id: String(i), count: 64 }))
      )
    ).toThrow()
  })
  it('retains unsaved drafts, then saves a validated project document', async () => {
    storage()
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('[]')))
    vi.stubGlobal('fetch', fetch)
    const editor = createAmbientEditor()
    await editor.load()
    editor.add({ x: 500, y: 300, width: 100, height: 80 })
    editor.change({ name: 'Petals', style: 'petal', count: 12, size: 1.5 })
    const reopened = createAmbientEditor()
    await reopened.load()
    expect(reopened.zones).toEqual(editor.zones)
    expect(reopened.dirty).toBe(true)
    fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await reopened.saveProject()
    expect(reopened.dirty).toBe(false)
    expect(JSON.parse(fetch.mock.calls.at(-1)![1].body)[0]).toMatchObject({
      count: 12,
      size: 1.5,
      style: 'petal',
    })
    reopened.change({ intensity: 0.3 })
    reopened.undo()
    expect(reopened.dirty).toBe(false)
  })
  it('keeps edits made during a save dirty and preserves them on save failure', async () => {
    storage()
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('[]')))
    vi.stubGlobal('fetch', fetch)
    const editor = createAmbientEditor()
    await editor.load()
    editor.add({ x: 0, y: 0, width: 80, height: 80 })
    let finish!: (r: Response) => void
    fetch.mockImplementationOnce(
      () =>
        new Promise<Response>(resolve => {
          finish = resolve
        })
    )
    const saving = editor.saveProject()
    editor.change({ count: 10 })
    finish(new Response(null, { status: 204 }))
    await saving
    expect(editor.dirty).toBe(true)
    fetch.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await editor.saveProject()
    expect(editor.error).toBe(true)
    expect(editor.zones[0].count).toBe(10)
  })
  it('does not overwrite project data when loading failed', async () => {
    storage()
    const fetch = vi.fn().mockRejectedValue(new Error('Offline'))
    vi.stubGlobal('fetch', fetch)
    const editor = createAmbientEditor()
    await editor.load()
    await editor.saveProject()
    expect(editor.loaded).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(newAmbientZone('butterfly', { x: 0, y: 0, width: 80, height: 80 }).count).toBe(3)
  })
})
