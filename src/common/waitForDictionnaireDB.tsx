import React from 'react'
import { useAtomValue } from 'jotai'

import { useTranslation } from 'react-i18next'
import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import { useDBStateValue } from '~helpers/databaseState'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import Box from './ui/Box'
import Progress from './ui/Progress'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResourceDatabaseAccess } from './resourceDatabaseAccess'

const DICTIONNAIRE_FILE_SIZE = 22532096

export const useWaitForDatabase = () => {
  const [
    {
      dictionnaire: { isLoading, proposeDownload, startDownload, progress },
    },
    dispatch,
  ] = useDBStateValue()

  // Get current resource language from Jotai
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const resourceLang = resourcesLanguage.DICTIONNAIRE

  useResourceDatabaseAccess({
    dbId: 'DICTIONNAIRE',
    fileSize: DICTIONNAIRE_FILE_SIZE,
    downloadKeyPrefix: 'dictionnaireDownloadHasStarted',
    logName: 'Dictionnaire',
    ensureDirBeforePrompt: true,
    state: { startDownload, lang: resourceLang },
    actions: {
      setLoading: value => dispatch({ type: 'dictionnaire.setLoading', payload: value }),
      setProposeDownload: value =>
        dispatch({ type: 'dictionnaire.setProposeDownload', payload: value }),
      setStartDownload: value =>
        dispatch({ type: 'dictionnaire.setStartDownload', payload: value }),
      setProgress: value => dispatch({ type: 'dictionnaire.setProgress', payload: value }),
    },
  })

  const setStartDownload = (value: boolean) =>
    dispatch({
      type: 'dictionnaire.setStartDownload',
      payload: value,
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
          <Loading message={t('Téléchargement du dictionnaire...')}>
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
          title={t('La base de données dictionnaire est requise pour accéder à cette page.')}
          setStartDownload={setStartDownload}
          fileSize={22}
        />
      )
    }

    if (isLoading) {
      return (
        <Loading
          message={t('Chargement du dictionnaire...')}
          subMessage={t('Merci de patienter, la première fois peut prendre plusieurs secondes...')}
        />
      )
    }
    return <WrappedComponent key={resourceLang} {...props} />
  }

export default waitForDatabase
