import React, { useState } from 'react'

import { useTranslation } from 'react-i18next'
import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import { useResourceDatabaseAccess } from './resourceDatabaseAccess'
import Box from './ui/Box'
import Progress from './ui/Progress'

const TRESOR_FILE_SIZE = 5434368

export const useWaitForDatabase = () => {
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState(0)

  useResourceDatabaseAccess({
    dbId: 'TRESOR',
    fileSize: TRESOR_FILE_SIZE,
    downloadKeyPrefix: 'tresorDownloadHasStarted',
    logName: 'Tresor',
    state: { startDownload, lang: 'fr' },
    actions: {
      setLoading,
      setProposeDownload,
      setStartDownload,
      setProgress,
    },
  })

  return {
    isLoading,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
  }
}

const waitForDatabase =
  <T extends object>(WrappedComponent: React.ComponentType<T>): React.ComponentType<T> =>
  (props: T) => {
    const { t } = useTranslation()
    const { isLoading, progress, proposeDownload, startDownload, setStartDownload } =
      useWaitForDatabase()

    if (isLoading && startDownload) {
      return (
        <Box h={300} alignItems="center">
          <Loading message={t('Téléchargement de la base commentaires...')}>
            <Progress progress={progress} />
          </Loading>
        </Box>
      )
    }

    if (isLoading && proposeDownload) {
      return (
        <DownloadRequired
          hasHeader={false}
          title={t(
            'La base de données "Trésor de l\'écriture" est requise pour accéder à ce module.'
          )}
          setStartDownload={setStartDownload}
          fileSize={5.4}
        />
      )
    }

    if (isLoading) {
      return (
        <Loading
          message={t('Chargement de la base de données...')}
          subMessage={t(
            "Merci de patienter, la première fois peut prendre plusieurs secondes... Si au bout de 30s il ne se passe rien, n'hésitez pas à redémarrer l'app."
          )}
        />
      )
    }

    return <WrappedComponent {...props} />
  }

export default waitForDatabase
