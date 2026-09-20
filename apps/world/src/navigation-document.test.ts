import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canStand,
  defaultNavigation,
  detailObstacles,
  findSafePosition,
  SPAWN,
  type NavigationDocument,
} from './world'
import {
  loadNavigation,
  NAVIGATION_FILE_URL,
  NAVIGATION_SAVE_ENDPOINT,
  parseNavigation,
  polygonIsValid,
  saveNavigation,
  serializeNavigation,
  navigationFingerprint,
  upgradeNavigation,
} from './navigation-document'

afterEach(() => vi.unstubAllGlobals())

describe('editable navigation documents', () => {
  it('round trips every existing zone without mutating defaults', () => {
    const doc = parseNavigation(JSON.parse(serializeNavigation(defaultNavigation)))
    expect(doc).toEqual(defaultNavigation)
    expect(navigationFingerprint(doc)).toBe(navigationFingerprint(defaultNavigation))
    expect(doc.zones[0]).not.toBe(defaultNavigation.zones[0])
    expect(doc.zones.filter(z => z.kind === 'blocked')).toHaveLength(20 + detailObstacles.length)
  })

  it('rejects incompatible maps, duplicate IDs, crossing and off-image polygons', () => {
    expect(() => parseNavigation({ ...defaultNavigation, width: 100 })).toThrow()
    expect(() =>
      parseNavigation({
        ...defaultNavigation,
        zones: [defaultNavigation.zones[0], defaultNavigation.zones[0]],
      })
    ).toThrow()
    expect(
      polygonIsValid([
        [0, 0],
        [100, 100],
        [0, 100],
        [100, 0],
      ])
    ).toBe(false)
    expect(
      polygonIsValid([
        [-1, 0],
        [100, 0],
        [100, 100],
      ])
    ).toBe(false)
    expect(
      polygonIsValid([
        [10, 10],
        [20, 10],
        [30, 10],
      ])
    ).toBe(false)
    expect(() =>
      parseNavigation({
        ...defaultNavigation,
        zones: [{ id: 'bad', name: 'bad', kind: 'allowed', points: [null] }],
      })
    ).toThrow()
  })

  it('lets a new red polygon override green and relocates a covered avatar', () => {
    const doc: NavigationDocument = {
      ...defaultNavigation,
      zones: [
        ...defaultNavigation.zones,
        {
          id: 'new-block',
          name: 'Obstacle',
          kind: 'blocked',
          points: [
            [816, 522],
            [856, 522],
            [856, 562],
            [816, 562],
          ],
        },
      ],
    }
    expect(canStand(SPAWN, defaultNavigation)).toBe(true)
    expect(canStand(SPAWN, doc)).toBe(false)
    const safe = findSafePosition(SPAWN, doc)
    expect(safe).not.toBeNull()
    expect(canStand(safe!, doc)).toBe(true)
  })

  it('blocks a narrow obstacle crossing the footprint even with its center outside', () => {
    const doc: NavigationDocument = {
      ...defaultNavigation,
      zones: [
        ...defaultNavigation.zones,
        {
          id: 'thin',
          name: 'Thin',
          kind: 'blocked',
          points: [
            [840, 539],
            [841, 539],
            [841, 545],
            [840, 545],
          ],
        },
      ],
    }
    expect(canStand(SPAWN, doc)).toBe(false)
  })

  it('loads the project navigation file and reports invalid project data', async () => {
    const edited = structuredClone(defaultNavigation)
    edited.zones[0].name = 'My plaza'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => edited,
    })
    vi.stubGlobal('fetch', fetchMock)
    expect((await loadNavigation()).document.zones[0].name).toBe('My plaza')
    expect(fetchMock).toHaveBeenCalledWith(NAVIGATION_FILE_URL, { cache: 'no-store' })

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    expect(await loadNavigation()).toEqual({ document: defaultNavigation, error: true })
  })

  it('uses source defaults only when the project navigation file does not exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const loaded = await loadNavigation()
    expect(loaded).toEqual({ document: defaultNavigation, error: false })
  })

  it('saves the validated document directly through the local project endpoint', async () => {
    const edited = structuredClone(defaultNavigation)
    edited.zones[0].name = 'My plaza'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)

    await saveNavigation(edited)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      NAVIGATION_SAVE_ENDPOINT,
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: serializeNavigation(edited),
      })
    )
  })

  it('adds the new obstacle set without overwriting edited greens or restoring old deletions', () => {
    const old = structuredClone(defaultNavigation)
    delete old.obstacleRevision
    old.zones = old.zones.filter(z => !z.id.startsWith('detail-') && z.id !== 'obstacle-1')
    old.zones[0].name = 'My custom plaza'
    old.zones[0].points = [
      [700, 400],
      [1000, 400],
      [1000, 600],
      [700, 600],
    ]
    const before = structuredClone(old)
    const migrated = upgradeNavigation(parseNavigation(old))
    expect(old).toEqual(before)
    expect(migrated.zones[0]).toEqual(old.zones[0])
    expect(migrated.zones.some(z => z.id === 'obstacle-1')).toBe(false)
    expect(migrated.zones.filter(z => z.id.startsWith('detail-'))).toEqual(detailObstacles)
    expect(migrated.obstacleRevision).toBe(2)
    expect(parseNavigation(migrated)).toEqual(migrated)
  })

  it('does not resurrect deleted detail obstacles on save, reload, or JSON import', () => {
    const edited = structuredClone(defaultNavigation)
    edited.zones = edited.zones.filter(z => z.id !== detailObstacles[0].id)
    const retained = edited.zones.find(z => z.id === detailObstacles[1].id)!
    retained.name = 'Adjusted shrub'
    expect(upgradeNavigation(parseNavigation(JSON.parse(serializeNavigation(edited))))).toEqual(
      edited
    )
  })
})
