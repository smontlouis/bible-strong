import { toast } from '~helpers/toast'
import i18n from '~i18n'
import { appLogger } from '~helpers/agentObservability'

const catchDBError = async <T>(fn: () => Promise<T>, cb?: () => void) => {
  try {
    return await fn()
  } catch (e) {
    console.log('[Database] Error =>', e)

    cb?.()

    if (!e) {
      appLogger.captureError(
        'database',
        'query.unknown_failure',
        new Error('DATABASE_UNKNOWN_ERROR'),
        { errorCode: 'UNKNOWN_ERROR' }
      )
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

      appLogger.captureError('database', 'query.corrupted_database', e, {
        errorCode: 'CORRUPTED_DATABASE',
      })

      throw new Error('CORRUPTED_DATABASE')
    }

    if (diskError) {
      appLogger.captureError('database', 'query.disk_io_failed', e, {
        errorCode: 'DISK_IO',
      })
      toast.error(i18n.t('Redémarrez votre application'), { duration: 5000 })

      throw new Error('DISK_IO')
    }

    toast.error(i18n.t('Une error est survenue, le développeur en a été informé.'), {
      duration: 5000,
    })

    console.log('[Database] Error:', e)
    appLogger.captureError('database', 'query.failed', e, { errorCode: 'UNKNOWN_ERROR' })

    throw new Error('UNKNOWN_ERROR')
  }
}

export default catchDBError
