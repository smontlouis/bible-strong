import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

/**
 * Strobi's floating bubble was put away on this device. Strobi itself stays: its page in the
 * settings opens it and brings the bubble back. Kept per device: one may want it on a tablet and
 * not on a phone.
 */
export const strobiBubbleHiddenAtom = atomWithAsyncStorage<boolean>(
  'assistant.launcher.hidden',
  false
)

export function useStrobiBubble() {
  const { t } = useTranslation()
  const confirm = useConfirmDialog()
  // The settings page is « Plus » on a phone and « Paramètres » in the wide workspace.
  const wide = useResponsiveWorkspace()
  const [hidden, setHidden] = useAtom(strobiBubbleHiddenAtom)
  /** Asks first, and says where the bubble comes back from. Resolves to whether it was hidden. */
  const confirmHide = async () => {
    const confirmed = await confirm({
      title: t('strobi.hide.title'),
      message: t('strobi.hide.message', { place: t(wide ? 'settings.settings' : 'Plus') }),
      cancelLabel: t('Annuler'),
      confirmLabel: t('strobi.hide.confirm'),
    })
    if (confirmed) setHidden(true)
    return confirmed
  }
  return { hidden, setHidden, confirmHide }
}
