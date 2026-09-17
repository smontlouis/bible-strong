import verseToReference from '~helpers/verseToReference'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookOpenIcon,
  FileSearchIcon,
  SearchIcon,
  LanguagesIcon,
  FileTextIcon,
  WrenchIcon,
  CircleAlertIcon,
} from 'lucide-react'
import type { ToolActivity } from '@bible-strong/ai-contract/contract'
import { ToolTimeline as OfficialToolTimeline } from './components/assistant-ui/elements/tool-timeline'

function target(tool: ToolActivity): string {
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
        verses: args.start
          ? [args.start, ...(args.end && args.end !== args.start ? [args.end] : [])]
          : [],
      })
  } catch {
    /* A bounded preview can end in an ellipsis. */
  }
  return tool.name
}
export default function ToolTimeline({
  tools,
  running,
}: {
  tools: ToolActivity[]
  running: boolean
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const steps = tools.map(tool => {
    const search = /search|find|concordance/.test(tool.name)
    const label = tool.name.includes('strong')
      ? 'strong'
      : tool.name.includes('passage')
        ? 'passage'
        : tool.name.includes('nave')
          ? 'nave'
          : tool.name.includes('comment')
            ? 'commentary'
            : tool.name.includes('dictionary')
              ? 'dictionary'
              : 'search'
    const failed = tool.state === 'error' || tool.state === 'interrupted'
    const icon = failed
      ? CircleAlertIcon
      : search
        ? FileSearchIcon
        : label === 'passage'
          ? BookOpenIcon
          : label === 'strong'
            ? LanguagesIcon
            : label === 'commentary' || label === 'dictionary'
              ? FileTextIcon
              : label === 'nave'
                ? SearchIcon
                : WrenchIcon
    return {
      verb: `${t(`assistant.tools.${label}`)}${failed ? ` · ${t(`assistant.tools.${tool.state}`)}` : ''}`,
      chip: target(tool),
      icon,
    }
  })
  return (
    <OfficialToolTimeline
      steps={steps}
      visibleSteps={steps.length}
      streaming={running && tools.some(tool => tool.state === 'running')}
      open={running || expanded}
      onOpenChange={setExpanded}
      restingLabel={t('assistant.tools.title', { count: tools.length })}
      activeLabel={t('assistant.searching')}
      stats={[]}
      className="bs-assistant-official-tools mb-3 max-w-none"
    />
  )
}
