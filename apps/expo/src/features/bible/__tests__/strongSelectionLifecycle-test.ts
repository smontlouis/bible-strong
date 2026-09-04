import {
  getStrongSelectionDOMContextKey,
  getStrongSelectionRelationItemsKey,
  getStrongSelectionRenderedContentKey,
  shouldDismissStrongSelectionForViewerState,
} from '../strongSelectionLifecycle'

const context = {
  version: 'LSG',
  book: 42,
  chapter: 2,
  strongMode: 'visible',
  interlinearMode: 'disabled',
  interlinearLocale: 'fr',
  parallelVersions: ['KJV'],
  focusVerses: [1, 2],
  contextDisplayMode: 'chapter',
  renderedContentKey: 'content-a',
  relationItemsKey: 'relations-a',
  annotationModeEnabled: false,
  strongRelationItemsVisible: true,
}

describe('getStrongSelectionDOMContextKey', () => {
  it('is stable while the rendered Bible content is unchanged', () => {
    expect(getStrongSelectionDOMContextKey(context)).toBe(
      getStrongSelectionDOMContextKey({ ...context })
    )
  })

  it.each([
    ['version', 'DBY'],
    ['book', 43],
    ['chapter', 3],
    ['strongMode', 'hidden'],
    ['interlinearMode', 'strong'],
    ['interlinearLocale', 'en'],
    ['parallelVersions', ['S21']],
    ['focusVerses', [3]],
    ['contextDisplayMode', 'focused'],
    ['renderedContentKey', 'content-b'],
    ['relationItemsKey', 'relations-b'],
    ['annotationModeEnabled', true],
    ['strongRelationItemsVisible', false],
  ] as const)('changes when %s replaces part of the rendered DOM', (field, value) => {
    expect(getStrongSelectionDOMContextKey({ ...context, [field]: value })).not.toBe(
      getStrongSelectionDOMContextKey(context)
    )
  })
})

describe('getStrongSelectionRelationItemsKey', () => {
  it('changes only when the rendered relation items change', () => {
    const relations = {
      '42-2-1': [{ id: 'relation-1', target: { type: 'strong', code: 'G1722' } }],
    }

    expect(getStrongSelectionRelationItemsKey(relations)).toBe(
      getStrongSelectionRelationItemsKey({ ...relations })
    )
    expect(getStrongSelectionRelationItemsKey({})).not.toBe(
      getStrongSelectionRelationItemsKey(relations)
    )
  })
})

describe('getStrongSelectionRenderedContentKey', () => {
  const verse = {
    Livre: 42,
    Chapitre: 2,
    Verset: 1,
    Texte: 'En 1722 ce temps 2250',
  }

  it('is stable when a reload returns identical rendered content', () => {
    expect(getStrongSelectionRenderedContentKey([verse], [])).toBe(
      getStrongSelectionRenderedContentKey([{ ...verse }], [])
    )
  })

  it('changes when the main or parallel Strong-bearing content is replaced', () => {
    const initial = getStrongSelectionRenderedContentKey(
      [verse],
      [{ id: 'KJV', verses: [{ ...verse, Texte: 'In 1722 those 1565 days 2250' }] }]
    )

    expect(
      getStrongSelectionRenderedContentKey(
        [{ ...verse, Texte: 'Le texte sans cet item' }],
        [{ id: 'KJV', verses: [{ ...verse, Texte: 'In 1722 those 1565 days 2250' }] }]
      )
    ).not.toBe(initial)
    expect(
      getStrongSelectionRenderedContentKey(
        [verse],
        [{ id: 'KJV', verses: [{ ...verse, Texte: 'Changed parallel content' }] }]
      )
    ).not.toBe(initial)
  })
})

describe('shouldDismissStrongSelectionForViewerState', () => {
  it('keeps the sheet mounted while the Bible tab remains active', () => {
    expect(
      shouldDismissStrongSelectionForViewerState({
        isActiveBibleTab: true,
        isFormSheet: false,
        isInTab: true,
      })
    ).toBe(false)
  })

  it('dismisses it when its owning Bible tab becomes inactive', () => {
    expect(
      shouldDismissStrongSelectionForViewerState({
        isActiveBibleTab: false,
        isFormSheet: false,
        isInTab: true,
      })
    ).toBe(true)
  })

  it('does not use stack focus to dismiss a form-sheet Bible viewer', () => {
    expect(
      shouldDismissStrongSelectionForViewerState({
        isActiveBibleTab: false,
        isFormSheet: true,
        isInTab: false,
      })
    ).toBe(false)
  })

  it('does not treat a standalone Bible viewer as an inactive tab', () => {
    expect(
      shouldDismissStrongSelectionForViewerState({
        isActiveBibleTab: false,
        isFormSheet: false,
        isInTab: false,
      })
    ).toBe(false)
  })
})
