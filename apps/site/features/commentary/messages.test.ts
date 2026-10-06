import { describe, expect, it } from 'vitest'
import { RESOURCE_LANGUAGES } from '../resources/publicSite'
import { commentaryMessages } from './messages'

describe('Commentary messages', () => {
  it('fills the placeholders of a message', () => {
    expect(commentaryMessages('fr')('commentary.chapter.page', { page: 2, count: 6 })).toBe(
      'Page 2 sur 6'
    )
    expect(commentaryMessages('en')('commentary.chapter.readBible', { reference: 'John 3' })).toBe(
      'Read John 3 in the Bible'
    )
  })

  it('keeps the description of the list within what a result page shows', () => {
    for (const language of RESOURCE_LANGUAGES) {
      const description = commentaryMessages(language)('commentary.index.head.description')
      expect(description.length).toBeLessThanOrEqual(155)
    }
  })
})
