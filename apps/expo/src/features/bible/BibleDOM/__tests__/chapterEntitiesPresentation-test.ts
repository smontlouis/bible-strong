import { getChapterEntitiesViewMode, splitChapterEntities } from '../chapterEntitiesPresentation'

describe('getChapterEntitiesViewMode', () => {
  it('shows the download card when contextual information is enabled but entities are missing', () => {
    expect(getChapterEntitiesViewMode('missing', false, 0)).toBe('download')
  })

  it('waits for entities when the module is available', () => {
    expect(getChapterEntitiesViewMode('available', false, 0)).toBe('hidden')
  })

  it('shows the empty state only after an available chapter has loaded', () => {
    expect(getChapterEntitiesViewMode('available', true, 0)).toBe('empty')
  })

  it('stays hidden when contextual information is disabled or availability is unresolved', () => {
    expect(getChapterEntitiesViewMode(null, false, 0)).toBe('hidden')
  })
})

describe('splitChapterEntities', () => {
  const entity = (uniqueName: string, category: string) => ({ uniqueName, category })

  it('takes the painted persons and supernatural beings out of the stack', () => {
    const { painted, stacked } = splitChapterEntities(
      [
        entity('Abner@1Sa.14.50-1Ch', 'person'),
        entity('Doeg@1Sa.21.7-Psa', 'person'),
        entity('Gabriel@Dan.8.16-Luk', 'supernatural'),
        entity('Bethlehem@Gen.35.16-Jhn', 'place'),
        entity('Philistines@Gen.10.14-Zep', 'group'),
      ],
      {
        'Abner@1Sa.14.50-1Ch': 'aaaaaa',
        'Gabriel@Dan.8.16-Luk': 'bbbbbb',
        'Bethlehem@Gen.35.16-Jhn': 'cccccc',
        'Philistines@Gen.10.14-Zep': 'dddddd',
      }
    )
    expect(painted.map(item => item.uniqueName)).toEqual([
      'Abner@1Sa.14.50-1Ch',
      'Gabriel@Dan.8.16-Luk',
    ])
    expect(stacked.map(item => item.uniqueName)).toEqual([
      'Doeg@1Sa.21.7-Psa',
      'Bethlehem@Gen.35.16-Jhn',
      'Philistines@Gen.10.14-Zep',
    ])
  })

  it('keeps everything in the stack until the catalog has arrived', () => {
    const entities = [entity('David@Rut.4.17-Rev', 'person')]
    expect(splitChapterEntities(entities, {})).toEqual({ painted: [], stacked: entities })
  })
})
