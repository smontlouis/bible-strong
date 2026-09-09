import { useTheme } from '~themes/ThemeProvider'
import { colorWithOpacity } from '~themes/colorValues'
import { Command } from 'cmdk'
import { useTranslation } from 'react-i18next'
import { useComputedPlanItems } from '~features/plans/plan.hooks'
import type { TabItem } from '~state/tabs'
import generateUUID from '~helpers/generateUUID'
import TabIcon from '../utils/getIconByTabType'
import { matchesQuery } from './results'

export default function PlanSuggestions({
  query,
  onSelect,
}: {
  query: string
  onSelect: (tab: TabItem) => void
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const plans = useComputedPlanItems().filter(plan => matchesQuery(query, plan.title))
  return (
    <Command.Group heading={t('Plans')}>
      {plans.slice(0, 8).map(plan => (
        <Command.Item
          key={plan.id}
          value={`plan:${plan.id}`}
          onSelect={() =>
            onSelect({
              id: generateUUID(),
              type: 'plan',
              title: plan.title,
              isRemovable: true,
              data: { planId: plan.id },
            })
          }
        >
          <span className="bs-command-item-label">
            <span
              className="bs-command-item-icon"
              aria-hidden="true"
              style={{ backgroundColor: colorWithOpacity(theme.colors.tertiary, 0.12) }}
            >
              <TabIcon type="plan" size={16} />
            </span>
            <span className="bs-command-item-text">{plan.title}</span>
          </span>
        </Command.Item>
      ))}
      {!plans.length && (
        <div className="bs-command-status" role="status">
          {t('commandPalette.noResults')}
        </div>
      )}
    </Command.Group>
  )
}
