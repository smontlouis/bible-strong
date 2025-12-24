import { toast } from 'sonner-native'
import i18n from '~i18n'

const catchDBError = async fn => {
  try {
    return await fn()
  } catch (e) {
    console.log('[Database] Error =>', e)

    if (!e) {
      toast.error(i18n.t('Une error est survenue.'), { duration: 5000 })
      return { error: 'UNKNOWN_ERROR' }
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

      return { error: 'CORRUPTED_DATABASE' }
    }

    if (diskError) {
      toast.error(i18n.t('Redémarrez votre application'), { duration: 5000 })

      return { error: 'DISK_IO' }
    }

    toast.error(i18n.t('Une error est survenue, le développeur en a été informé.'), {
      duration: 5000,
    })

    console.log('[Database] Error:', e)

    return { error: 'UNKNOWN_ERROR' }
  }
}

export default catchDBError
