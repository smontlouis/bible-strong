import { useTranslation } from 'react-i18next'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'

export function useConfirmDelete() {
  const { t } = useTranslation()
  const confirm = useConfirmDialog()
  return async (message: string, onConfirm: () => void) => {
    if (
      await confirm({
        title: t('Attention'),
        message,
        cancelLabel: t('Non'),
        confirmLabel: t('Supprimer'),
        destructive: true,
      })
    )
      onConfirm()
  }
}
