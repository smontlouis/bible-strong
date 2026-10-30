import { describe, expect, it } from 'vitest'
import { entityClayUrl, parseAtlasPortraitCatalog } from './atlasPortraits'
import { ATLAS_HOLY_LAND_VIEW, ATLAS_MAP_WIDTH, projectAtlasPlace } from './atlasProjection'
import {
  atlasFamilyOf,
  buildAtlasCardPath,
  buildAtlasEntityPath,
  buildAtlasRoutePath,
  parseAtlasCardId,
  parseAtlasRoute,
} from './atlasRoutes'

describe('atlas routes', () => {
  it('reads the home, a family and an entity', () => {
    expect(parseAtlasRoute({ language: 'fr' })).toEqual({ language: 'fr', kind: 'home' })
    expect(parseAtlasRoute({ language: 'EN', name: 'Places' })).toEqual({
      language: 'en',
      kind: 'family',
      family: 'places',
    })
    expect(parseAtlasRoute({ language: 'fr', name: 'David@Rut.4.17-Rev' })).toEqual({
      language: 'fr',
      kind: 'entity',
      uniqueName: 'David@Rut.4.17-Rev',
    })
  })

  it('refuses a language it does not publish and a name that is not a unique name', () => {
    expect(parseAtlasRoute({ language: 'de' })).toBeUndefined()
    expect(parseAtlasRoute({ language: 'fr', name: 'david' })).toBeUndefined()
    expect(parseAtlasRoute({ language: 'fr', name: '%E0%A4%A' })).toBeUndefined()
  })

  it('keeps @ in an address and encodes what a path cannot carry', () => {
    expect(buildAtlasEntityPath('fr', 'David@Rut.4.17-Rev')).toBe('/atlas/fr/David@Rut.4.17-Rev')
    expect(buildAtlasEntityPath('en', "King's_Highway@Num.20.17-")).toBe(
      "/atlas/en/King's_Highway@Num.20.17-"
    )
    expect(buildAtlasEntityPath('fr', 'Name with space@Gen.1.1')).toBe(
      '/atlas/fr/Name%20with%20space@Gen.1.1'
    )
  })

  it('rebuilds the canonical path of what it read', () => {
    for (const path of ['/atlas/fr', '/atlas/en/beings', '/atlas/fr/Jerusalem@Gen.14.18-Rev']) {
      const [, , language, name] = path.split('/')
      const route = parseAtlasRoute({ language, name })
      expect(route && buildAtlasRoutePath(route)).toBe(path)
    }
  })

  it('files supernatural beings apart from the other entities', () => {
    expect(atlasFamilyOf('supernatural')).toBe('beings')
    expect(atlasFamilyOf('other')).toBe('others')
    expect(atlasFamilyOf('group')).toBe('groups')
  })
})

describe('atlas pictures', () => {
  it('gives an entity the clay figure the application gives it', () => {
    // The application picks among five by an FNV-1a hash of the unique name.
    expect(entityClayUrl('person', 'Male', 'Zechariah@1Ch.24.25')).toMatch(
      /^\/atlas\/clay\/male-[1-5]\.webp$/u
    )
    expect(entityClayUrl('person', 'Female', 'Hannah@1Sa.1.2')).toMatch(/^\/atlas\/clay\/female-/u)
    expect(entityClayUrl('place', 'Place', 'Bethel@Gen.12.8-Zec')).toBe('/atlas/clay/place-1.webp')
    expect(entityClayUrl('supernatural', 'Supernatural', 'Baal@Num.22.41-Rom')).toBe(
      '/atlas/clay/supernatural-1.webp'
    )
    expect(entityClayUrl('other', 'Time', 'Sabbath@Exo.16.23-Heb')).toBe('/atlas/clay/time-1.webp')
    expect(entityClayUrl('person', 'Male', 'A@b')).toBe(entityClayUrl('person', 'Male', 'A@b'))
  })

  it('keeps the well-formed entries of a catalog', () => {
    const catalog = parseAtlasPortraitCatalog({
      version: 3,
      entities: {
        'David@Rut.4.17-Rev': {
          hash: 'abcdef12',
          title: { fr: 'Le berger', en: 'The shepherd' },
          stages: [
            {
              key: 'roi',
              label: { fr: 'Le roi', en: 'The king' },
              hash: '12345678',
              ranges: [{ book: 10, from: 5, to: 24 }],
            },
            { key: 'broken', label: { fr: 'x', en: 'x' }, hash: 'nothex', ranges: [] },
          ],
        },
        'Broken@Gen.1.1': { hash: 'zz' },
      },
      series: [{ id: 'rois', title: { fr: 'Rois', en: 'Kings' }, members: ['David@Rut.4.17-Rev'] }],
      roles: { roi: { fr: 'Roi', en: 'King' } },
    })
    expect(Object.keys(catalog?.entities ?? {})).toEqual(['David@Rut.4.17-Rev'])
    expect(catalog?.entities['David@Rut.4.17-Rev'].stages.map(stage => stage.key)).toEqual(['roi'])
    expect(catalog?.series).toHaveLength(1)
    expect(parseAtlasPortraitCatalog({ version: 2, entities: {} })).toBeUndefined()
  })
})

describe('atlas map', () => {
  it('places Jerusalem inside the Promised Land and leaves out what lies outside the map', () => {
    const jerusalem = projectAtlasPlace(31.78, 35.23)
    expect(jerusalem).toBeDefined()
    const [x, y] = jerusalem ?? [0, 0]
    expect(x).toBeGreaterThan(ATLAS_HOLY_LAND_VIEW.x)
    expect(x).toBeLessThan(ATLAS_HOLY_LAND_VIEW.x + ATLAS_HOLY_LAND_VIEW.width)
    expect(y).toBeGreaterThan(ATLAS_HOLY_LAND_VIEW.y)
    expect(y).toBeLessThan(ATLAS_HOLY_LAND_VIEW.y + ATLAS_HOLY_LAND_VIEW.height)
    expect(projectAtlasPlace(22, 77)).toBeUndefined()
    expect(ATLAS_MAP_WIDTH).toBe(3901)
  })

  it('gives a card an address of its own, life stage included', () => {
    expect(buildAtlasCardPath('fr', 'Israel@Gen.25.26-Rev~vieux')).toBe(
      '/atlas/fr/cards/Israel@Gen.25.26-Rev~vieux'
    )
    expect(buildAtlasCardPath('en', "Ba'al@Num.22.41-Rom")).toBe(
      "/atlas/en/cards/Ba'al@Num.22.41-Rom"
    )
    expect(parseAtlasCardId('Israel%40Gen.25.26-Rev~vieux')).toBe('Israel@Gen.25.26-Rev~vieux')
    expect(parseAtlasCardId('booster')).toBeUndefined()
    expect(parseAtlasCardId('%E0%A4%A')).toBeUndefined()
  })
})
