import {
  OFFLINE_SETUP_PRESET_IDS,
  getOfflineSetupPresetSelections,
  resolveOfflineSetupSelections,
} from '../offlineSetupPresets'

const getSelectionId = (
  selection: ReturnType<typeof getOfflineSetupPresetSelections>[number]
): string => {
  if (selection.kind === 'database') {
    return `database:${selection.databaseId}:${selection.lang}`
  }
  if (selection.kind === 'bible' || selection.kind === 'bible-strong') {
    return `${selection.kind}:${selection.versionId}`
  }
  if (selection.kind === 'bible-interlinear') {
    return `${selection.kind}:${selection.lang}`
  }
  return `${selection.kind}:${selection.moduleId ?? 'core'}`
}

describe('offline setup presets', () => {
  it('includes biblical entities and its core dependency in Explore the Bible', () => {
    const ids = getOfflineSetupPresetSelections('explore-bible', 'fr').map(getSelectionId)

    expect(ids).toContain('strong-lexicon:entities')
    expect(ids).toContain('strong-lexicon:core')
    expect(ids).toHaveLength(6)
  })

  it('uses the localized default Bible for reading and Strong study', () => {
    expect(getOfflineSetupPresetSelections('read-bible', 'fr')).toContainEqual({
      kind: 'bible',
      versionId: 'LSG',
    })
    expect(getOfflineSetupPresetSelections('understand-words', 'en')).toContainEqual({
      kind: 'bible-strong',
      versionId: 'KJV',
    })
  })

  it('deduplicates shared technical dependencies when every need is selected', () => {
    const selections = resolveOfflineSetupSelections(OFFLINE_SETUP_PRESET_IDS, 'fr')
    const ids = selections.map(getSelectionId)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.filter(id => id === 'strong-lexicon:core')).toHaveLength(1)
  })
})
