import {
  getAvailableUpdates,
  hasUnseenUpdates,
  markUpdatesSeen,
  resourceNeedsUpdate,
} from '../availableUpdates'
import type {
  LocalResourceRef,
  OfflineResourceRegistryEntry,
  OfflineResourceRegistrySnapshot,
} from '../resourceAvailability'

const entry = (
  id: string,
  resource: LocalResourceRef,
  status: string,
  options: { updateAvailable?: boolean; catalogRevision?: string } = {}
): OfflineResourceRegistryEntry =>
  ({
    id,
    resource,
    availability: { status, resource },
    verified: true,
    updateAvailable: options.updateAvailable ?? false,
    catalogRevision: options.catalogRevision,
  }) as OfflineResourceRegistryEntry

const snapshot = (entries: OfflineResourceRegistryEntry[]): OfflineResourceRegistrySnapshot => ({
  revision: 1,
  phase: 'ready',
  resources: new Map(entries.map(item => [item.id, item])),
})

const lsg = entry('bible:LSG', { kind: 'bible', versionId: 'LSG' }, 'available', {
  updateAvailable: true,
  catalogRevision: 'lsg-new',
})
const kjv = entry('bible:KJV', { kind: 'bible', versionId: 'KJV' }, 'available', {
  catalogRevision: 'kjv-same',
})

describe('available updates', () => {
  it('counts newer archives and sidecars that no longer match their base', () => {
    expect(resourceNeedsUpdate(lsg)).toBe(true)
    expect(resourceNeedsUpdate(kjv)).toBe(false)
    expect(
      resourceNeedsUpdate(
        entry(
          'bible-strong:LSG',
          { kind: 'strong-bible-index', versionId: 'LSG' as never },
          'incompatible'
        )
      )
    ).toBe(true)
    expect(
      resourceNeedsUpdate(
        entry(
          'strong-lexicon:resources',
          { kind: 'strong-lexicon-module', moduleId: 'resources' },
          'core-missing'
        )
      )
    ).toBe(true)
    expect(
      resourceNeedsUpdate(
        entry(
          'bible-interlinear:BHG:fr',
          { kind: 'interlinear-index', versionId: 'BHG', language: 'fr' },
          'base-incompatible'
        )
      )
    ).toBe(true)
  })

  it('ignores resources the downloads list never shows on their own', () => {
    const pericope = entry(
      'bible-pericope:LSG',
      { kind: 'bible-pericope', versionId: 'LSG' },
      'available',
      { updateAvailable: true }
    )
    expect([...getAvailableUpdates(snapshot([lsg, kjv, pericope])).keys()]).toEqual(['bible:LSG'])
  })

  it('signals updates until they are seen, and again for a newer revision', () => {
    const updates = getAvailableUpdates(snapshot([lsg, kjv]))
    expect(hasUnseenUpdates(updates, {})).toBe(true)

    const seen = markUpdatesSeen(updates, {})
    expect(hasUnseenUpdates(updates, seen)).toBe(false)
    expect(markUpdatesSeen(updates, seen)).toBe(seen)

    const newer = getAvailableUpdates(snapshot([{ ...lsg, catalogRevision: 'lsg-newer' }, kjv]))
    expect(hasUnseenUpdates(newer, seen)).toBe(true)
  })

  it('stays quiet once installed copies are up to date', () => {
    const seen = markUpdatesSeen(getAvailableUpdates(snapshot([lsg])), {})
    const updates = getAvailableUpdates(snapshot([{ ...lsg, updateAvailable: false }, kjv]))
    expect(updates.size).toBe(0)
    expect(hasUnseenUpdates(updates, seen)).toBe(false)
    expect(markUpdatesSeen(updates, seen)).toBe(seen)
  })
})
