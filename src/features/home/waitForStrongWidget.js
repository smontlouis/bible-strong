import React from 'react'
import { ProgressBar } from 'react-native-paper'

import { wp } from '~helpers/utils'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import { useWaitForDatabase } from '~common/waitForStrongDB'
import DownloadRequired from '~common/DownloadRequired'

const itemWidth = wp(60)
const itemHeight = 130

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
      <Box center rounded height={itemHeight} width={itemWidth} marginRight={20}>
        <Loading message="Téléchargement de la base strong...">
          <ProgressBar progress={progress} color="blue" />
        </Loading>
      </Box>
    )
  }

  if (isLoading && proposeDownload) {
    return (
      <Box center rounded height={itemHeight} width={itemWidth} marginRight={20}>
        <DownloadRequired
          noHeader
          title="Base de données strong requise."
          setStartDownload={setStartDownload}
          fileSize={35}
          small
        />
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box center rounded height={itemHeight} width={itemWidth} marginRight={20}>
        <Loading />
      </Box>
    )
  }

  return <WrappedComponent {...props} />
}

export default waitForWidget
