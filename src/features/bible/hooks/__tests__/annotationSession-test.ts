import {
  INITIAL_ANNOTATION_SESSION_STATE,
  clearSelectedAnnotation,
  enterAnnotationSession,
  exitAnnotationSession,
  markAnnotationCreated,
  markAnnotationSelectionErased,
  requestApplyAnnotation,
  requestClearAnnotationSelectionRange,
  requestEraseAnnotationSelection,
  selectAnnotation,
  updateAnnotationSelection,
  type SelectionRange,
} from '../annotationSession'

const selection: SelectionRange = {
  start: { verseKey: '1-1-1', wordIndex: 0 },
  end: { verseKey: '1-1-1', wordIndex: 1 },
}

describe('annotationSession', () => {
  it('enters and exits Mode libre for a Bible version', () => {
    expect(enterAnnotationSession('LSG')).toMatchObject({
      enabled: true,
      version: 'LSG',
      hasSelection: false,
      selectedAnnotationId: null,
    })
    expect(exitAnnotationSession()).toEqual(INITIAL_ANNOTATION_SESSION_STATE)
  })

  it('accepts only valid DOM selections', () => {
    const state = enterAnnotationSession('LSG')

    expect(updateAnnotationSelection(state, true, selection)).toMatchObject({
      hasSelection: true,
      selection,
    })
    expect(updateAnnotationSelection(state, true, null)).toMatchObject({
      hasSelection: false,
      selection: null,
    })
  })

  it('increments apply trigger only when a selection exists', () => {
    const stateWithoutSelection = enterAnnotationSession('LSG')
    const stateWithSelection = updateAnnotationSelection(stateWithoutSelection, true, selection)

    expect(requestApplyAnnotation(stateWithoutSelection, 'color1', 'underline')).toBe(
      stateWithoutSelection
    )
    expect(requestApplyAnnotation(stateWithSelection, 'color1', 'underline')).toMatchObject({
      applyAnnotationTrigger: {
        count: 1,
        color: 'color1',
        type: 'underline',
      },
    })
  })

  it('clears and erases selections with trigger counters', () => {
    const state = updateAnnotationSelection(enterAnnotationSession('LSG'), true, selection)

    expect(requestClearAnnotationSelectionRange(state)).toMatchObject({
      hasSelection: false,
      selection: null,
      clearSelectionTrigger: 1,
    })
    expect(requestEraseAnnotationSelection(state)).toMatchObject({
      eraseSelectionTrigger: 1,
    })
    expect(requestEraseAnnotationSelection(enterAnnotationSession('LSG'))).toEqual(
      enterAnnotationSession('LSG')
    )
  })

  it('auto-selects newly created annotations and clears the word range selection', () => {
    const state = updateAnnotationSelection(enterAnnotationSession('LSG'), true, selection)

    expect(markAnnotationCreated(state, 'annotation-1')).toMatchObject({
      hasSelection: false,
      selection: null,
      selectedAnnotationId: 'annotation-1',
    })
  })

  it('clears range selection after erase and when selecting existing annotations', () => {
    const state = updateAnnotationSelection(enterAnnotationSession('LSG'), true, selection)

    expect(markAnnotationSelectionErased(state)).toMatchObject({
      hasSelection: false,
      selection: null,
    })
    expect(selectAnnotation(state, 'annotation-1')).toMatchObject({
      selectedAnnotationId: 'annotation-1',
      hasSelection: false,
      selection: null,
    })
  })

  it('clears selected annotation with a DOM trigger', () => {
    const state = selectAnnotation(enterAnnotationSession('LSG'), 'annotation-1')

    expect(clearSelectedAnnotation(state)).toMatchObject({
      selectedAnnotationId: null,
      clearAnnotationSelectionTrigger: 1,
    })
  })
})
