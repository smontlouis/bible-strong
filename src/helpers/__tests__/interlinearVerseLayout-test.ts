import { buildInterlinearVerseLayout } from '../interlinearVerseLayout'

const token = (startOffset: number, length: number, ordinal: number) => ({
  ordinal,
  startOffset,
  length,
  segments: [],
})

describe('buildInterlinearVerseLayout', () => {
  it('preserves every canonical character around indexed tokens', () => {
    const text = 'Ἐν ἀρχῇ, ὁ λόγος.'
    const surfaceToken = (surface: string, ordinal: number) =>
      token(text.indexOf(surface), surface.length, ordinal)
    const layout = buildInterlinearVerseLayout(text, [
      surfaceToken('ἀρχῇ', 1),
      surfaceToken('Ἐν', 0),
      surfaceToken('ὁ', 2),
      surfaceToken('λόγος', 3),
    ])

    expect(
      layout.pieces.map(piece => `${piece.prefix}${piece.surface}`).join('') + layout.trailing
    ).toBe(text)
    expect(layout.pieces.map(piece => piece.surface)).toEqual(['Ἐν', 'ἀρχῇ', 'ὁ', 'λόγος'])
  })

  it('ignores overlapping or out-of-range token offsets without duplicating text', () => {
    const text = 'abc def'
    const layout = buildInterlinearVerseLayout(text, [
      token(0, 3, 0),
      token(2, 3, 1),
      token(99, 1, 2),
      token(4, 3, 3),
    ])

    expect(layout.pieces.map(piece => piece.surface)).toEqual(['abc', 'def'])
    expect(
      layout.pieces.map(piece => `${piece.prefix}${piece.surface}`).join('') + layout.trailing
    ).toBe(text)
  })
})
