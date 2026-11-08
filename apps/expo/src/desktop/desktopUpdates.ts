import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'

import { appLogger } from '~helpers/agentObservability'
import { toast } from '~helpers/toast'
import i18n from '~i18n'

import { desktopBootstrap } from './bridge'

let pending: Update | undefined

const installAndRelaunch = async (update: Update) => {
  const id = toast.info(i18n.t('desktop.update.installing'), { duration: Infinity })
  try {
    await update.downloadAndInstall()
    await relaunch()
  } catch (error) {
    toast.dismiss(id)
    appLogger.captureError('startup', 'desktop.update.install_failed', error)
    toast.error(i18n.t('desktop.update.failed'))
  }
}

/**
 * Looks for a signed update (`tauri-plugin-updater`). The Mac App Store build has no updater:
 * the store updates it. `announce` reports an up-to-date app too, for the menu command.
 */
export const checkDesktopUpdate = async ({ announce }: { announce: boolean }) => {
  if (!desktopBootstrap().updater) return
  try {
    pending = (await check()) ?? undefined
  } catch (error) {
    appLogger.warn('startup', 'desktop.update.check_failed', { error })
    if (announce) toast.error(i18n.t('desktop.update.failed'))
    return
  }
  if (!pending) {
    if (announce) toast.success(i18n.t('desktop.update.upToDate'))
    return
  }
  const update = pending
  toast.info(i18n.t('desktop.update.available', { version: update.version }), {
    duration: Infinity,
    action: {
      label: i18n.t('desktop.update.restart'),
      onClick: () => void installAndRelaunch(update),
    },
  })
}
