import type {
  LocalResourceRef,
  OfflineResourceRegistryEntry,
  OfflineResourceRegistrySnapshot,
} from '../resourceAvailability'
import { holdsPageWithStudyLinks, needsStudyLinksCopy } from '../studyLinksOfflineCopy'

const entry = (
  id: string,
  resource: LocalResourceRef,
  status: 'available' | 'missing' | 'corrupt',
  updateAvailable = false
) =>
  [
    id,
    { id, resource, availability: { status }, updateAvailable } as OfflineResourceRegistryEntry,
  ] as const

const snapshot = (...entries: ReturnType<typeof entry>[]) =>
  ({ resources: new Map(entries) }) as unknown as OfflineResourceRegistrySnapshot

const links = (status: 'available' | 'missing' | 'corrupt', updateAvailable = false) =>
  entry('study-links', { kind: 'study-links' }, status, updateAvailable)

const dictionary = entry(
  'dictionary:westphal:WESTPHAL:fr',
  { kind: 'dictionary', work: 'westphal', resourceId: 'WESTPHAL', language: 'fr' },
  'available'
)
const nave = entry(
  'database:NAVE:fr',
  { kind: 'database', databaseId: 'NAVE', language: 'fr' },
  'available'
)
const timeline = entry(
  'database:TIMELINE:en',
  { kind: 'database', databaseId: 'TIMELINE', language: 'en' },
  'available'
)
const entities = entry(
  'strong-lexicon:entities',
  { kind: 'strong-lexicon-module', moduleId: 'entities' },
  'available'
)
const bible = entry('bible:LSG', { kind: 'bible', versionId: 'LSG' }, 'available')

describe('study links offline copy', () => {
  it('follows any Offline copy that shows the links', () => {
    for (const copy of [dictionary, nave, timeline, entities]) {
      expect(needsStudyLinksCopy(snapshot(links('missing'), copy))).toBe(true)
    }
  })

  it('stays away from a device with nothing that shows them', () => {
    expect(needsStudyLinksCopy(snapshot(links('missing'), bible))).toBe(false)
    expect(
      needsStudyLinksCopy(
        snapshot(links('missing'), entry(dictionary[0], dictionary[1].resource, 'missing'))
      )
    ).toBe(false)
  })

  it('follows the catalog and repairs a broken copy', () => {
    expect(needsStudyLinksCopy(snapshot(links('available'), dictionary))).toBe(false)
    expect(needsStudyLinksCopy(snapshot(links('available', true), dictionary))).toBe(true)
    expect(needsStudyLinksCopy(snapshot(links('corrupt'), dictionary))).toBe(true)
  })

  it('does nothing before the catalog lists the links', () => {
    expect(needsStudyLinksCopy(snapshot(dictionary))).toBe(false)
  })

  it('lets the links leave with the last copy that shows them', () => {
    expect(holdsPageWithStudyLinks(snapshot(links('available'), nave))).toBe(true)
    expect(holdsPageWithStudyLinks(snapshot(links('available'), bible))).toBe(false)
  })
})
