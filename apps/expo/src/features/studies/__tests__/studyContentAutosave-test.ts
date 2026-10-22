import {
  createStudyContentAutosave,
  STUDY_AUTOSAVE_DELAY_MS,
  STUDY_AUTOSAVE_MAX_WAIT_MS,
} from '../studyContentAutosave'

const content = (text: string) => ({ ops: [{ insert: text }] })

describe('study content autosave', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('saves the latest content once the typing pauses', () => {
    const save = jest.fn()
    const autosave = createStudyContentAutosave(save)

    autosave.schedule({ id: 'study', content: content('a') })
    jest.advanceTimersByTime(STUDY_AUTOSAVE_DELAY_MS - 1)
    autosave.schedule({ id: 'study', content: content('ab') })
    jest.advanceTimersByTime(STUDY_AUTOSAVE_DELAY_MS - 1)
    expect(save).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ id: 'study', content: content('ab') })
  })

  it('saves during long uninterrupted typing', () => {
    const save = jest.fn()
    const autosave = createStudyContentAutosave(save)

    for (let elapsed = 0; elapsed < STUDY_AUTOSAVE_MAX_WAIT_MS; elapsed += 1000) {
      autosave.schedule({ id: 'study', content: content(String(elapsed)) })
      jest.advanceTimersByTime(1000)
    }

    expect(save).toHaveBeenCalledTimes(1)
  })

  it('saves at once on flush, and only what is waiting', () => {
    const save = jest.fn()
    const autosave = createStudyContentAutosave(save)

    autosave.flush()
    autosave.schedule({ id: 'study', content: content('a') })
    autosave.flush()
    autosave.flush()
    jest.advanceTimersByTime(STUDY_AUTOSAVE_DELAY_MS)

    expect(save).toHaveBeenCalledTimes(1)
  })

  it('does not hold the edits of one Study behind another', () => {
    const save = jest.fn()
    const autosave = createStudyContentAutosave(save)

    autosave.schedule({ id: 'first', content: content('a') })
    autosave.schedule({ id: 'second', content: content('b') })

    expect(save).toHaveBeenCalledWith({ id: 'first', content: content('a') })
    autosave.flush()
    expect(save).toHaveBeenLastCalledWith({ id: 'second', content: content('b') })
  })
})
