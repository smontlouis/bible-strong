import type { ToolActivity } from '@bible-strong/ai-contract/contract'
import verseToReference from '~helpers/verseToReference'

export type ToolActivityKind =
  | 'strong'
  | 'commentary'
  | 'passage'
  | 'nave'
  | 'dictionary'
  | 'search'

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
