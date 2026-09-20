import { afterEach, describe, expect, it, vi } from 'vitest'
import { createShoreEditor, parseShorelines, prepareShore, simplify } from './shorelines'

describe('shoreline geometry and saved outlines', () => {
  it('keeps open endpoints and produces finite normals for repeated points', () => {
    const curve = prepareShore([
      [10, 10],
      [10, 10],
      [20, 30],
      [40, 40],
    ])
    expect(curve[0]).toMatchObject({ x: 10, y: 10 })
    expect(curve.at(-1)).toMatchObject({ x: 40, y: 40 })
    expect(curve.every(p => Number.isFinite(p.nx) && Number.isFinite(p.ny))).toBe(true)
    expect(
      prepareShore([
        [10, 10],
        [10, 10],
      ])
    ).toEqual([])
  })
  it('joins both position and normal around a closed rock outline', () => {
    const curve = prepareShore(
      [
        [0, 0],
        [20, 0],
        [20, 20],
        [0, 20],
      ],
      true
    )
    const a = curve[0],
      b = curve.at(-1)!
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.00001)
    expect(a.nx).toBeCloseTo(b.nx)
    expect(a.ny).toBeCloseTo(b.ny)
  })
  it('simplifies freehand jitter while retaining the bend and endpoints', () => {
    expect(
      simplify([
        [0, 0],
        [5, 0.1],
        [10, 0],
        [10, 10],
      ])
    ).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ])
  })
  it('rejects malformed storage and unbounded geometry', () => {
    const line = {
      id: 'coast',
      points: [
        [0, 0],
        [20, 20],
      ],
      closed: false,
      side: 1,
      width: 17,
      period: 3,
      strength: 0.45,
    }
    expect(parseShorelines([line])).toEqual([line])
    for (const value of [
      null,
      {},
      [{ ...line, period: 0 }],
      [
        {
          ...line,
          points: [
            [Infinity, 0],
            [0, 0],
          ],
        },
      ],
      [{ ...line, points: Array(257).fill([0, 0]) }],
    ]) {
      expect(() => parseShorelines(value)).toThrow()
    }
  })
})

describe('project shoreline saves', () => {
  afterEach(() => vi.unstubAllGlobals())
  const line = {
    id: 'saved',
    points: [
      [0, 0],
      [20, 20],
    ],
    closed: false,
    side: 1,
    width: 17,
    period: 3,
    strength: 0.45,
  }
  function storage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial))
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    })
    return data
  }
  it('migrates legacy browser outlines only after a confirmed project save', async () => {
    const data = storage({ 'bible-strong-shorelines-v1': JSON.stringify([line]) })
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('[]'))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    const model = createShoreEditor()
    await model.load()
    expect(model.lines).toEqual([line])
    expect(model.dirty).toBe(true)
    await model.saveProject()
    expect(model.saveError).toBe(true)
    expect(data.has('bible-strong-shorelines-v1')).toBe(true)
    expect(model.dirty).toBe(true)
    await model.saveProject()
    expect(model.saveError).toBe(false)
    expect(model.dirty).toBe(false)
    expect(data.has('bible-strong-shorelines-v1')).toBe(false)
    expect(fetch.mock.calls[2][1].body).toBe(JSON.stringify([line]))
  })
  it('loads the project rather than a draft based on an older project version', async () => {
    storage({ 'bible-strong-shorelines-draft-v2': JSON.stringify({ base: '[]', lines: [] }) })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([line]))))
    const model = createShoreEditor()
    await model.load()
    expect(model.lines).toEqual([line])
    expect(model.dirty).toBe(false)
  })
  it('never writes an empty replacement when project loading fails', async () => {
    storage()
    const fetch = vi.fn().mockRejectedValue(new Error('Offline'))
    vi.stubGlobal('fetch', fetch)
    const model = createShoreEditor()
    await model.load()
    await model.saveProject()
    expect(model.loaded).toBe(false)
    expect(model.saveError).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
