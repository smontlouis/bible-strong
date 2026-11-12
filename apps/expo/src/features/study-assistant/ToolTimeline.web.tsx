import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookOpenIcon,
  CalendarDaysIcon,
  ExternalLinkIcon,
  FileSearchIcon,
  SearchIcon,
  LanguagesIcon,
  FileTextIcon,
  LibraryIcon,
  UserRoundIcon,
  WrenchIcon,
  CircleAlertIcon,
} from 'lucide-react'
import type { ToolActivity } from '@bible-strong/ai-contract/contract'
import { ToolTimeline as OfficialToolTimeline } from './components/assistant-ui/elements/tool-timeline'
import {
  toolActivityChip,
  toolActivityDetail,
  toolActivityFailed,
  toolActivityIsSearch,
  toolActivityKind,
} from './toolActivity'

/**
 * Resources the assistant consulted: open while it searches, folded as soon as its answer
 * starts (2026-11-08), and open again on a click. Each line says what it found when the service
 * tells (2026-11-12); the step the assistant is at shows in the thread's progress line.
 */
export default function ToolTimeline({
  tools,
  running,
  writing,
}: {
  tools: ToolActivity[]
  /** The run is going: a resource still being read shows its activity. */
  running: boolean
  /** The answer has started to show. */
  writing: boolean
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const steps = tools.map(tool => {
    const search = toolActivityIsSearch(tool)
    const label = toolActivityKind(tool)
    const failed = toolActivityFailed(tool)
    const icon = failed
      ? CircleAlertIcon
      : label === 'library'
        ? LibraryIcon
        : label === 'document'
          ? FileTextIcon
          : label === 'reference'
            ? UserRoundIcon
            : label === 'editorial'
              ? CalendarDaysIcon
              : label === 'tab'
                ? ExternalLinkIcon
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
      chip: toolActivityChip(tool, t),
      detail: toolActivityDetail(tool, t),
      icon,
    }
  })
  return (
    <OfficialToolTimeline
      steps={steps}
      visibleSteps={steps.length}
      streaming={running && tools.some(tool => tool.state === 'running')}
      open={(running && !writing) || expanded}
      onOpenChange={setExpanded}
      restingLabel={t('assistant.tools.title', { count: tools.length })}
      activeLabel={t('assistant.tools.title', { count: tools.length })}
      stats={[]}
      className="bs-assistant-official-tools mb-3 max-w-none"
    />
  )
}
