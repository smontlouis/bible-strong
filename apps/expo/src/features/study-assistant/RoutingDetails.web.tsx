import { useTranslation } from 'react-i18next'
import type { RoutingDecision } from '@bible-strong/ai-contract/contract'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './components/ui/collapsible'
export default function RoutingDetails({ decisions }: { decisions: RoutingDecision[] }) {
  const { t } = useTranslation()
  return (
    <Collapsible className="bs-assistant-routing">
      <CollapsibleTrigger>{t('assistant.routing.title')}</CollapsibleTrigger>
      <CollapsibleContent>
        <p>{t('assistant.routing.explanation')}</p>
        {decisions.map(decision => (
          <section key={decision.sequence}>
            <strong>{t(`assistant.routing.${decision.phase}`)}</strong>
            <p>
              {t('assistant.routing.families')} :{' '}
              {decision.selectedFamilies
                .map(family => t(`assistant.routing.family.${family}`, { defaultValue: family }))
                .join(', ') || t('assistant.routing.none')}
            </p>
            <ul>
              {decision.allowedTools.map(tool => (
                <li key={tool}>
                  <code>{tool}</code>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
