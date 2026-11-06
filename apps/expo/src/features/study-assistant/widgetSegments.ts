/**
 * The assistant places a card by writing [title](https://bible-strong.app/assistant-widget/w3)
 * where it belongs in its answer (private ADR-0101). The message is then shown as a
 * sequence of Markdown and cards, in the order the reader should see them.
 */
export const WIDGET_LINK_PREFIX = 'https://bible-strong.app/assistant-widget/'
const WIDGET_LINK =
  /\[([^\]\n]{1,200})\]\(https:\/\/bible-strong\.app\/assistant-widget\/([a-z0-9]{1,8})\)/g

export type MessageSegment =
  | { type: 'markdown'; text: string }
  | { type: 'widget'; id: string; label: string }

/**
 * Splits an answer at the card links whose widget belongs to this message. A link to
 * an unknown card keeps only its title, inside the surrounding Markdown.
 */
export function messageSegments(text: string, widgetIds: ReadonlySet<string>): MessageSegment[] {
  const segments: MessageSegment[] = []
  let markdown = '',
    last = 0
  const pushMarkdown = () => {
    if (markdown.trim()) segments.push({ type: 'markdown', text: markdown.trim() })
    markdown = ''
  }
  for (const match of text.matchAll(WIDGET_LINK)) {
    const [raw, label, id] = match
    markdown += text.slice(last, match.index)
    last = match.index + raw.length
    if (!widgetIds.has(id) || segments.some(s => s.type === 'widget' && s.id === id)) {
      markdown += label
      continue
    }
    pushMarkdown()
    segments.push({ type: 'widget', id, label })
  }
  markdown += text.slice(last)
  pushMarkdown()
  return segments
}

/** The widget ids an answer places, so the message does not show them a second time. */
export const placedWidgetIds = (text: string, widgetIds: ReadonlySet<string>) =>
  new Set(
    messageSegments(text, widgetIds).flatMap(segment =>
      segment.type === 'widget' ? [segment.id] : []
    )
  )
