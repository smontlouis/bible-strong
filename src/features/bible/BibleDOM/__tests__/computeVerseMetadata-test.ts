import {
  getLinkedVersesCount,
  getLinkedVersesText,
  getNotedVersesCount,
  getNotedVersesText,
} from '../computeVerseMetadata'

const verses = [
  { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'Verse 1' },
  { Livre: 1, Chapitre: 1, Verset: 2, Texte: 'Verse 2' },
  { Livre: 1, Chapitre: 1, Verset: 3, Texte: 'Verse 3' },
]

describe('compute verse metadata', () => {
  it('anchors inline multi-verse notes on the ending verse', () => {
    const notes = {
      '1-1-1/1-1-2#note-1': {
        id: 'note-1',
        title: 'Note',
        description: 'Description',
        date: 1,
      },
    }

    expect(getNotedVersesCount(verses, notes, {}, 'inline')).toEqual({ '2': 1 })
    expect(getNotedVersesText(verses, notes)).toMatchObject({
      '2': [{ id: 'note-1', verses: '1-2' }],
    })
  })

  it('anchors icon multi-verse notes on the starting verse', () => {
    const notes = {
      '1-1-1#note-1': {
        id: 'note-1',
        title: 'Note 1',
        description: 'Description',
        date: 1,
      },
      '1-1-1/1-1-2#note-2': {
        id: 'note-2',
        title: 'Note 2',
        description: 'Description',
        date: 2,
      },
    }

    expect(getNotedVersesCount(verses, notes, {}, 'block')).toEqual({ '1': 2 })
  })

  it('anchors inline multi-verse links on the ending verse', () => {
    const links = {
      '1-1-2/1-1-3#link-1': {
        id: 'link-1',
        url: 'https://example.com',
        linkType: 'website' as const,
        date: 1,
      },
    }

    expect(getLinkedVersesCount(verses, links, 'inline')).toEqual({ '3': 1 })
    expect(getLinkedVersesText(verses, links)).toMatchObject({
      '3': [{ id: 'link-1', verses: '2-3' }],
    })
  })

  it('anchors icon multi-verse links on the starting verse', () => {
    const links = {
      '1-1-1#link-1': {
        id: 'link-1',
        url: 'https://example.com/1',
        linkType: 'website' as const,
        date: 1,
      },
      '1-1-1/1-1-2#link-2': {
        id: 'link-2',
        url: 'https://example.com/2',
        linkType: 'website' as const,
        date: 2,
      },
    }

    expect(getLinkedVersesCount(verses, links, 'block')).toEqual({ '1': 2 })
  })
})
