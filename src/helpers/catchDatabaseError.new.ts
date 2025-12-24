import * as Sentry from '@sentry/react-native'
import { toast } from 'sonner-native'
import i18n from '~i18n'

const catchDBError = async <T>(fn: () => Promise<T>, cb?: () => void) => {
  try {
    return await fn()
  } catch (e) {
    console.log('[Database] Error =>', e)

    cb?.()

    if (!e) {
      toast.error(i18n.t('Une error est survenue.'), { duration: 5000 })
      throw new Error('UNKNOWN_ERROR')
    }

    const corruptedDBError = e.toString().includes('no such table')
    const diskError = e.toString().includes('Error code 10: disk I/O error')

    if (corruptedDBError) {
      toast.error(
        i18n.t(
          'Une error est survenue, la base de données est peut-être corrompue. Rendez-vous dans la gestion de téléchargements pour retélécharger la base de données.'
        ),
        { duration: 5000 }
      )

      Sentry.withScope(scope => {
        scope.setExtra('Error', e.toString())
        Sentry.captureMessage('Database corrupted')
      })

      throw new Error('CORRUPTED_DATABASE')
    }

    if (diskError) {
      toast.error(i18n.t('Redémarrez votre application'), { duration: 5000 })

      throw new Error('DISK_IO')
    }

    toast.error(i18n.t('Une error est survenue, le développeur en a été informé.'), {
      duration: 5000,
    })

    console.log('[Database] Error:', e)
    Sentry.captureException(e)

    throw new Error('UNKNOWN_ERROR')
  }
}

export default catchDBError
