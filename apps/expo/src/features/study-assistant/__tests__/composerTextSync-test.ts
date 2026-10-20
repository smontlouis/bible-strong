import {
  createComposerTextSync,
  receiveComposerText,
  sendComposerText,
  type ComposerTextSync,
} from '../composerTextSync'

const typeTexts = (sync: ComposerTextSync, texts: string[]) =>
  texts.reduce((current, text) => sendComposerText(current, text), sync)

describe('composer text sync', () => {
  it('keeps what the user types while the store catches up', () => {
    const typed = typeTexts(createComposerTextSync(''), ['a', 'ab', 'abc'])

    const late = receiveComposerText(typed, 'ab')
    expect(late.fieldText).toBeUndefined()

    const caughtUp = receiveComposerText(late.sync, 'abc')
    expect(caughtUp.fieldText).toBeUndefined()
    expect(caughtUp.sync).toEqual(createComposerTextSync('abc'))
  })

  it('shows a text the store gets from elsewhere', () => {
    const typed = typeTexts(createComposerTextSync(''), ['Who was Festus?'])
    const caughtUp = receiveComposerText(typed, 'Who was Festus?').sync

    // A sent message clears the composer
    expect(receiveComposerText(caughtUp, '')).toEqual({
      sync: createComposerTextSync(''),
      fieldText: '',
    })
    // Dictation fills it
    expect(receiveComposerText(caughtUp, 'Who was Festus? And Felix').fieldText).toBe(
      'Who was Festus? And Felix'
    )
  })

  it('clears a field the user emptied and then sent nothing from', () => {
    const typed = typeTexts(createComposerTextSync('abc'), ['ab', 'a', ''])
    const caughtUp = receiveComposerText(typed, '').sync

    expect(caughtUp).toEqual(createComposerTextSync(''))
    expect(receiveComposerText(caughtUp, 'dictated').fieldText).toBe('dictated')
  })
})
