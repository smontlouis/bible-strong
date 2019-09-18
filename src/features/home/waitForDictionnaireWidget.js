import React from 'react'
import { ProgressBar } from 'react-native-paper'

import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import { useWaitForDatabase } from '~common/waitForDictionnaireDB'
import DownloadRequired from '~common/DownloadRequired'

const waitForWidget = WrappedComponent => props => {
  const {
    isLoading,
    startDownload,
    proposeDownload,
    setStartDownload,
    progress
  } = useWaitForDatabase()

  if (isLoading && startDownload) {
    return (
      <Box center shadow height={150}>
        <Loading message="Téléchargement du dictionnaire...">
          <ProgressBar progress={progress} color="blue" />
        </Loading>
      </Box>
    )
  }

  if (isLoading && proposeDownload) {
    return (
      <Box center shadow height={150}>
        <DownloadRequired
          noHeader
          title="Le dictionnaire est requis pour accéder à ce widget."
          setStartDownload={setStartDownload}
          fileSize={35}
          small
        />
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box center shadow height={150}>
        <Loading />
      </Box>
    )
  }

  return <WrappedComponent {...props} />
}

export default waitForWidget
