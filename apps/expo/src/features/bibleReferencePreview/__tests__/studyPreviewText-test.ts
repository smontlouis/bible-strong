import { studyPreviewText } from '../studyPreviewText'
it('retains authored paragraphs and embedded labels in reading order', () => {
  expect(
    studyPreviewText({
      ops: [
        { insert: 'Mon introduction\n' },
        { insert: { entityBlock: { display: { title: 'Jean 3:16' } } } },
        { insert: 'Conclusion' },
      ],
    })
  ).toBe('Mon introduction\n\nJean 3:16\nConclusion')
})
it('handles legacy keyed operations and legacy verse labels', () => {
  expect(
    studyPreviewText({
      ops: { 0: { insert: { verse: { title: 'Genèse 1:1' } } }, 1: { insert: 'Texte' } },
    })
  ).toBe('Genèse 1:1\nTexte')
})
it('handles empty and malformed content without throwing', () => {
  expect(studyPreviewText(undefined)).toBe('')
  expect(studyPreviewText({ ops: [null, {}, true, { retain: 4 }] })).toBe('')
})
