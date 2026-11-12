import type { ToolActivity } from '@bible-strong/ai-contract/contract'
import {
  toolActivityChip,
  toolActivityDetail,
  toolActivityFailed,
  toolActivityIsSearch,
  toolActivityKind,
  toolActivityTarget,
} from '../toolActivity'
import { statusProgressKey } from '../studySteps'

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

  it('names the tools whose names say nothing a general rule could read', () => {
    expect(toolActivityKind(tool('search_library', {}))).toBe('library')
    expect(toolActivityKind(tool('read_library_document', {}))).toBe('document')
    expect(toolActivityKind(tool('read_reference_resource', {}))).toBe('reference')
    expect(toolActivityKind(tool('list_reading_steps', {}))).toBe('editorial')
    expect(toolActivityKind(tool('search_bible_text', {}))).toBe('verses')
    expect(toolActivityKind(tool('compare_translations', {}))).toBe('passage')
    expect(toolActivityKind(tool('list_passage_commentaries', {}))).toBe('commentary')
  })

  // A translation that shows its key and options, so the test reads what was asked for.
  const t = (key: string, options?: Record<string, unknown>) =>
    options
      ? `${key}(${Object.entries(options)
          .map(([k, v]) => `${k}=${v}`)
          .join(';')})`
      : key

  it('says what a library search found: how many texts, from which traditions', () => {
    const search = {
      ...tool('search_library', { query: 'le sabbat' }),
      summary: { count: 17, perspectives: ['adventist', 'catholic', 'unknown'], items: ['SDABC'] },
    }
    expect(toolActivityChip(search, t)).toBe('le sabbat')
    expect(toolActivityDetail(search, t)).toBe(
      'assistant.tools.count.texts(count=17) · assistant.tools.traditions(count=2;list=assistant.perspectives.adventist, assistant.perspectives.catholic)'
    )
    const works = { ...search, summary: { count: 3, items: ['Westphal', 'Calmet'] } }
    expect(toolActivityDetail(works, t)).toBe(
      'assistant.tools.count.texts(count=3) · Westphal, Calmet'
    )
    expect(toolActivityDetail({ ...search, summary: { count: 0 } }, t)).toBe(
      'assistant.tools.nothingFound'
    )
  })

  it('shows what was read when the request names nothing readable', () => {
    const verses = { ...tool('read_passage', { ranges: 8 }), summary: { count: 8 } }
    expect(toolActivityChip(verses, t)).toBe('assistant.tools.count.passages(count=8)')
    expect(toolActivityDetail(verses, t)).toBeUndefined()
    const document = {
      ...tool('read_library_document', { collection: 'c', documentKey: 'k' }),
      summary: { items: ['Le sabbat dans le Nouveau Testament'] },
    }
    expect(toolActivityChip(document, t)).toBe('Le sabbat dans le Nouveau Testament')
    expect(toolActivityDetail(document, t)).toBeUndefined()
  })

  it('says nothing more for a call still running, failed, or from a service without summaries', () => {
    const summary = { count: 4 }
    expect(
      toolActivityDetail({ ...tool('search_library', {}, 'running'), summary }, t)
    ).toBeUndefined()
    expect(
      toolActivityDetail({ ...tool('search_library', {}, 'error'), summary }, t)
    ).toBeUndefined()
    expect(toolActivityDetail(tool('search_library', { query: 'x' }), t)).toBeUndefined()
  })

  it('shows the step the service is at, and resources being read for an older service', () => {
    expect(statusProgressKey('searching')).toBe('assistant.steps.searching')
    expect(statusProgressKey('composing')).toBe('assistant.steps.composing')
    expect(statusProgressKey('resources')).toBe('assistant.searching')
    expect(statusProgressKey('anything')).toBe('assistant.searching')
  })
})
