import React, { useState } from 'react'
import { useAtomValue } from 'jotai'

import { useTranslation } from 'react-i18next'
import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import Box from './ui/Box'
import Progress from './ui/Progress'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResourceDatabaseAccess } from './resourceDatabaseAccess'

const FILE_SIZE = 7448576

export const useWaitForDatabase = () => {
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState<number>(0)

  // Get current resource language from Jotai
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const resourceLang = resourcesLanguage.NAVE

  useResourceDatabaseAccess({
    dbId: 'NAVE',
    fileSize: FILE_SIZE,
    downloadKeyPrefix: 'naveDownloadHasStarted',
    logName: 'Nave',
    state: { startDownload, lang: resourceLang },
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
    resourceLang,
  }
}

const waitForDatabase =
  ({
    hasBackButton,
    hasHeader,
    size,
    useStackBackButton,
  }: {
    hasBackButton?: boolean
    size?: 'small' | 'large'
    hasHeader?: boolean
    useStackBackButton?: boolean
  } = {}) =>
  <T extends object>(WrappedComponent: React.ComponentType<T>): React.ComponentType<T> =>
  (props: T) => {
    const { t } = useTranslation()
    const canGoBackInStack = useCanGoBackInStack()
    const effectiveHasBackButton = useStackBackButton ? canGoBackInStack : hasBackButton
    const { isLoading, progress, proposeDownload, startDownload, setStartDownload, resourceLang } =
      useWaitForDatabase()

    if (isLoading && startDownload) {
      return (
        <Box h={300} alignItems="center">
          <Loading message={t('Téléchargement des thèmes...')}>
            <Progress progress={progress} />
          </Loading>
        </Box>
      )
    }

    if (isLoading && proposeDownload) {
      return (
        <DownloadRequired
          hasBackButton={effectiveHasBackButton}
          hasHeader={hasHeader}
          size={size}
          title={t(
            'La base de données "Bible thématique Nave" est requise pour accéder à ce module.'
          )}
          setStartDownload={setStartDownload}
          fileSize={7}
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

    return <WrappedComponent key={resourceLang} {...props} />
  }

export default waitForDatabase
