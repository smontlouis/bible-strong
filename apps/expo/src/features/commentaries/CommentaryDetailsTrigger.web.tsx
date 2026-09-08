import { useTranslation } from 'react-i18next'
import ContextualPanel from '~common/ContextualPanel'
import { FeatherIcon } from '~common/ui/Icon'
import CommentarySourceDetails from './CommentarySourceDetails'
import type { CommentaryDetailsTriggerProps } from './CommentaryDetailsTrigger'
export default function CommentaryDetailsTrigger({ projection }: CommentaryDetailsTriggerProps) {
  const { t } = useTranslation()
  return (
    <ContextualPanel
      width={420}
      triggerSize={46}
      trigger={<FeatherIcon name="more-horizontal" size={20} />}
      accessibilityLabel={t('commentaries.details.manage', { commentary: projection.entry.title })}
      initialScreen="details"
      screens={{
        details: {
          title: projection.entry.title,
          content: () => <CommentarySourceDetails projection={projection} />,
        },
      }}
    />
  )
}
