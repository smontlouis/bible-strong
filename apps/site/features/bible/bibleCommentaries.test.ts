import { describe, expect, it } from 'vitest'
import {
  commentVersesLabel,
  parseInlineCommentaries,
  placeCommentarySections,
  renderInlineComments,
  validateBibleSearch,
  withInlineCommentaries,
} from './bibleCommentaries'

describe('parseInlineCommentaries', () => {
  it('reads a choice in its one spelling', () => {
    expect(parseInlineCommentaries('barnes.mhy-fr')).toEqual(['barnes', 'mhy-fr'])
  })

  it('reads the values of a form sent without scripting, and a comma list', () => {
    expect(parseInlineCommentaries(['mhy-fr', 'barnes'])).toEqual(['barnes', 'mhy-fr'])
    expect(parseInlineCommentaries('mhy-fr,barnes')).toEqual(['barnes', 'mhy-fr'])
  })

  it('keeps each name once and leaves out what cannot name a commentary', () => {
    expect(parseInlineCommentaries('barnes.barnes.<b>.A.')).toEqual(['barnes'])
    expect(parseInlineCommentaries(undefined)).toEqual([])
    expect(parseInlineCommentaries(3)).toEqual([])
  })

  it('shows five commentaries at most', () => {
    expect(parseInlineCommentaries('aa.bb.cc.dd.ee.ff.gg')).toEqual(['aa', 'bb', 'cc', 'dd', 'ee'])
  })
})

describe('validateBibleSearch', () => {
  it('writes a choice in its one spelling and nothing else', () => {
    expect(validateBibleSearch({ commentary: ['mhy-fr', 'barnes'], page: 2 })).toEqual({
      commentary: 'barnes.mhy-fr',
    })
    expect(validateBibleSearch({ commentary: '' })).toEqual({})
  })
})

describe('withInlineCommentaries', () => {
  it('keeps the choice of the reader on a path, before its anchor', () => {
    expect(withInlineCommentaries('/bible/lsg/john/3', ['barnes', 'mhy-fr'])).toBe(
      '/bible/lsg/john/3?commentary=barnes.mhy-fr'
    )
    expect(withInlineCommentaries('/bible/lsg/john/3#v16', ['barnes'])).toBe(
      '/bible/lsg/john/3?commentary=barnes#v16'
    )
  })

  it('leaves a path alone when nothing is shown', () => {
    expect(withInlineCommentaries('/bible/lsg/john/3', [])).toBe('/bible/lsg/john/3')
  })
})

describe('placeCommentarySections', () => {
  const run = (startVerse: number, endVerse: number) => ({ startVerse, endVerse })
  const chapter = [1, 2, 3, 4, 5, 6]

  it('reads a comment after the last verse it comments', () => {
    const placed = placeCommentarySections([run(1, 3), run(3, 3), run(4, 6)], chapter)
    expect([...placed]).toEqual([
      [3, [run(1, 3), run(3, 3)]],
      [6, [run(4, 6)]],
    ])
  })

  it('reads the introduction of a chapter before its first verse', () => {
    expect([...placeCommentarySections([run(0, 0)], chapter)]).toEqual([[0, [run(0, 0)]]])
  })

  it('keeps, for a quoted passage, the comments that bear on it', () => {
    const placed = placeCommentarySections([run(0, 0), run(1, 2), run(2, 4), run(5, 6)], [3, 4])
    expect([...placed]).toEqual([[4, [run(2, 4)]]])
  })

  it('stops a comment that runs past the verses shown at the last one', () => {
    expect([...placeCommentarySections([run(5, 9)], chapter)]).toEqual([[6, [run(5, 9)]]])
  })
})

describe('commentVersesLabel', () => {
  it('names the verses a comment bears on', () => {
    expect(commentVersesLabel({ startVerse: 16, endVerse: 16 }, 'fr')).toBe('v. 16')
    expect(commentVersesLabel({ startVerse: 16, endVerse: 18 }, 'en')).toBe('v. 16-18')
    expect(commentVersesLabel({ startVerse: 0, endVerse: 4 }, 'en')).toBe('v. 1-4')
    expect(commentVersesLabel({ startVerse: 0, endVerse: 0 }, 'fr')).toBe('Introduction')
  })
})

describe('renderInlineComments', () => {
  it('renders each comment as a link to its section, escaped', () => {
    const html = renderInlineComments(
      [
        {
          commentary: 'barnes',
          title: 'Barnes’ Notes <on> the Bible',
          section: '16-16',
          path: '/commentary/fr/barnes/john/3/16-16',
          startVerse: 16,
          endVerse: 16,
          excerpt: 'For God so loved the world & gave',
        },
      ],
      'fr'
    )
    expect(html).toBe(
      '<div class="bible-comments" lang="fr"><a class="bible-comment" href="/commentary/fr/barnes/john/3/16-16" data-commentary="barnes" data-section="16-16"><span class="bible-comment__source">Barnes’ Notes &lt;on&gt; the Bible · v. 16</span><span class="bible-comment__excerpt">For God so loved the world &amp; gave</span></a></div>'
    )
  })
})
