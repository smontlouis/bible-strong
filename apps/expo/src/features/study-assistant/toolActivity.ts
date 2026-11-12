import type { ToolActivity } from '@bible-strong/ai-contract/contract'
import verseToReference from '~helpers/verseToReference'

export type ToolActivityKind =
  | 'strong'
  | 'commentary'
  | 'passage'
  | 'nave'
  | 'dictionary'
  | 'library'
  | 'document'
  | 'reference'
  | 'editorial'
  | 'verses'
  | 'tab'
  | 'access'
  | 'search'

/** Tools whose name says nothing a general rule could read. */
const KIND_BY_NAME: Record<string, ToolActivityKind> = {
  search_library: 'library',
  read_library_document: 'document',
  read_reference_resource: 'reference',
  search_editorial_readings: 'editorial',
  list_reading_steps: 'editorial',
  read_editorial_reading: 'editorial',
  get_book_overview: 'editorial',
  suggest_study_resources: 'editorial',
  search_bible_text: 'verses',
  compare_translations: 'passage',
  open_tab: 'tab',
  request_tool_access: 'access',
}

/** The resource a tool call was aimed at, as a short readable label. */
export function toolActivityTarget(tool: ToolActivity): string {
  try {
    const args = JSON.parse(tool.request)
    for (const key of [
      'reference',
      'query',
      'code',
      'strong',
      'word',
      'topic',
      'name',
      'entryId',
    ]) {
      if (typeof args?.[key] === 'string' && args[key]) return args[key].slice(0, 80)
    }
    if (Number.isInteger(args?.book) && Number.isInteger(args?.chapter))
      return verseToReference({
        bookNum: args.book,
        chapterNum: args.chapter,
        // The whole range, so that 1 to 27 reads "1:1-27" and not the two verses "1:1,27".
        verses: Number.isInteger(args.start)
          ? Array.from(
              { length: Math.max(1, Math.min((args.end ?? args.start) - args.start + 1, 176)) },
              (_, i) => args.start + i
            )
          : [],
      })
  } catch {
    /* A bounded preview can end in an ellipsis. */
  }
  return tool.name
}

export function toolActivityKind(tool: ToolActivity): ToolActivityKind {
  const named = KIND_BY_NAME[tool.name]
  if (named) return named
  return tool.name.includes('strong')
    ? 'strong'
    : tool.name.includes('comment')
      ? 'commentary'
      : tool.name.includes('passage')
        ? 'passage'
        : tool.name.includes('nave')
          ? 'nave'
          : tool.name.includes('dictionary')
            ? 'dictionary'
            : 'search'
}

export const toolActivityIsSearch = (tool: ToolActivity) =>
  /search|find|concordance/.test(tool.name)

export const toolActivityFailed = (tool: ToolActivity) =>
  tool.state === 'error' || tool.state === 'interrupted'

type Translate = (key: string, options?: Record<string, unknown>) => string

/** How many of what a call found, by the kind of resource. */
const countKey = (kind: ToolActivityKind) =>
  kind === 'library'
    ? 'assistant.tools.count.texts'
    : kind === 'passage'
      ? 'assistant.tools.count.passages'
      : kind === 'verses'
        ? 'assistant.tools.count.verses'
        : kind === 'commentary'
          ? 'assistant.tools.count.commentaries'
          : 'assistant.tools.count.results'

const KNOWN_PERSPECTIVES = [
  'adventist',
  'catholic',
  'orthodox',
  'patristic',
  'jewish',
  'evangelical',
  'protestant',
  'academic',
]

/**
 * The chip of a call: what it was aimed at, or, when its request names nothing readable (a
 * document opened by key, the passages the server read at once), what it read.
 */
export function toolActivityChip(tool: ToolActivity, t: Translate): string {
  const target = toolActivityTarget(tool)
  if (target !== tool.name) return target
  const item = tool.summary?.items?.[0]
  if (item) return item
  const count = tool.summary?.count
  if (count) return t(countKey(toolActivityKind(tool)), { count })
  return target
}

/**
 * The line under a call, from what the service says it found (2026-11-12): how many texts and
 * from which traditions for a library search, otherwise the works or entry it read. Nothing for a
 * call still running or failed, or from a service that sends no summary.
 */
export function toolActivityDetail(tool: ToolActivity, t: Translate): string | undefined {
  const summary = tool.summary
  if (!summary || tool.state !== 'complete') return undefined
  const chip = toolActivityChip(tool, t)
  const kind = toolActivityKind(tool)
  const parts: string[] = []
  if (summary.count !== undefined && t(countKey(kind), { count: summary.count }) !== chip)
    parts.push(
      summary.count === 0
        ? t('assistant.tools.nothingFound')
        : t(countKey(kind), { count: summary.count })
    )
  const perspectives = (summary.perspectives || []).filter(perspective =>
    KNOWN_PERSPECTIVES.includes(perspective)
  )
  if (perspectives.length)
    parts.push(
      t('assistant.tools.traditions', {
        count: perspectives.length,
        list: perspectives
          .map(perspective => t(`assistant.perspectives.${perspective}`))
          .join(', '),
      })
    )
  else {
    const items = (summary.items || []).filter(item => item !== chip).slice(0, 3)
    if (items.length) parts.push(items.join(', '))
  }
  return parts.length ? parts.join(' · ') : undefined
}
