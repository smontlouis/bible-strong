import { verseToRedWords } from '../verseToRedWords'

describe('verseToRedWords', () => {
  it('ignores the empty-verse sentinel when rendering text', () => {
    expect(verseToRedWords('Text present', [{ start: 0, end: -1 }], '#cc0000')).toEqual([
      'Text present',
    ])
  })
})
