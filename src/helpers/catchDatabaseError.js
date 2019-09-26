import Sentry from 'sentry-expo'
import SnackBar from '~common/SnackBar'

const catchDBError = async fn => {
  try {
    return await fn()
  } catch (e) {
    const corruptedDBError = e.toString().includes('no such table')
    const diskError = e.toString().includes('Error code 10: disk I/O error')

    console.log(e)

    if (corruptedDBError) {
      SnackBar.show(
        'Une error est survenue, la base de données est peut-être corrompue. Rendez-vous dans la gestion de téléchargements pour retélécharger la base de données.',
        'danger',
        { duration: 5000 }
      )
      Sentry.captureMessage('Database corrupted', {
        extra: {
          error: e
        }
      })
      return { error: 'CORRUPTED_DATABASE' }
    }

    if (diskError) {
      SnackBar.show('Redémarrez votre application', 'danger', {
        duration: 5000
      })

      return { error: 'DISK_IO' }
    }

    SnackBar.show('Une error est survenue, le développeur en a été informé.', 'danger', {
      duration: 5000
    })
    Sentry.captureException(e)

    return { error: 'UNKNOWN_ERROR' }
  }
}

export default catchDBError
