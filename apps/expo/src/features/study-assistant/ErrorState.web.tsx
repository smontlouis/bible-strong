import { useTranslation } from 'react-i18next'
import { ErrorState as OfficialErrorState } from './components/assistant-ui/elements/error-state'
export default function ErrorState({
  title,
  detail,
  retrying = false,
  onRetry,
}: {
  title: string
  detail: string
  retrying?: boolean
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  return (
    <OfficialErrorState
      title={title}
      detail={detail}
      retrying={retrying}
      onRetry={onRetry}
      retryLabel={t('assistant.errors.retry')}
      retryingLabel={t('assistant.errors.retrying')}
      className="my-3 max-w-none"
    />
  )
}
