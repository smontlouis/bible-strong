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
import {
  toolActivityFailed,
  toolActivityIsSearch,
  toolActivityKind,
  toolActivityTarget,
} from './toolActivity'

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
    const search = toolActivityIsSearch(tool)
    const label = toolActivityKind(tool)
    const failed = toolActivityFailed(tool)
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
      chip: toolActivityTarget(tool),
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
