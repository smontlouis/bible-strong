import type { ToolActivity } from '@bible-strong/ai-contract/contract'
import {
  toolActivityFailed,
  toolActivityIsSearch,
  toolActivityKind,
  toolActivityTarget,
} from '../toolActivity'

jest.mock('~helpers/verseToReference', () => ({
  __esModule: true,
  default: ({
    bookNum,
    chapterNum,
    verses,
  }: {
    bookNum: number
    chapterNum: number
    verses?: number[]
  }) => `${bookNum}:${chapterNum}${verses?.length ? ':' + verses.join(',') : ''}`,
}))

const tool = (name: string, request: object | string, state: ToolActivity['state'] = 'complete') =>
  ({
    callId: 'c1',
    name,
    request: typeof request === 'string' ? request : JSON.stringify(request),
    result: '',
    state,
  }) satisfies ToolActivity

describe('tool activity shown to the reader', () => {
  it('names the resource a call was aimed at', () => {
    expect(toolActivityTarget(tool('read_strong_entry', { code: 'G25' }))).toBe('G25')
    expect(
      toolActivityTarget(tool('read_passage', { book: 43, chapter: 3, start: 16, end: 18 }))
    ).toBe('43:3:16,17,18')
    expect(toolActivityTarget(tool('read_passage', { book: 43, chapter: 3 }))).toBe('43:3')
    expect(toolActivityTarget(tool('get_passage', { book: 1, chapter: 1, start: 5, end: 5 }))).toBe(
      '1:1:5'
    )
  })

  it('passes the whole verse range, so that 1 to 27 is not read as verses 1 and 27', () => {
    const target = toolActivityTarget(
      tool('get_passage', { book: 10, chapter: 1, start: 1, end: 27 })
    )
    expect(target.split(':')[2].split(',')).toHaveLength(27)
  })

  it('falls back to the tool name when the bounded request cannot be read', () => {
    expect(toolActivityTarget(tool('search_nave', '{"query":"pat…'))).toBe('search_nave')
  })

  it('classifies a call by the resource family and by whether it searched', () => {
    expect(toolActivityKind(tool('read_strong_entry', {}))).toBe('strong')
    expect(toolActivityKind(tool('read_commentary_section', {}))).toBe('commentary')
    expect(toolActivityKind(tool('read_dictionary_entry', {}))).toBe('dictionary')
    expect(toolActivityKind(tool('unknown_tool', {}))).toBe('search')
    expect(toolActivityIsSearch(tool('find_concordance', {}))).toBe(true)
    expect(toolActivityIsSearch(tool('read_passage', {}))).toBe(false)
  })

  it('treats an interrupted call as failed, not as running', () => {
    expect(toolActivityFailed(tool('read_passage', {}, 'interrupted'))).toBe(true)
    expect(toolActivityFailed(tool('read_passage', {}, 'error'))).toBe(true)
    expect(toolActivityFailed(tool('read_passage', {}, 'running'))).toBe(false)
  })
})
