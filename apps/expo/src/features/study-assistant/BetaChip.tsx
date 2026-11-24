import { useTranslation } from 'react-i18next'
import { Chip } from '~common/ui/NewChip'

/** Says the assistant is in beta, wherever Strobi is named as a destination. */
export default function BetaChip({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <Chip variant="bold" className={className}>
      {t('assistant.beta')}
    </Chip>
  )
}
