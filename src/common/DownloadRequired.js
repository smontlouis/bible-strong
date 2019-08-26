import React from 'react'
import * as Icon from '@expo/vector-icons'

import Header from '~common/Header'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Button from '~common/ui/Button'

const DownloadRequired = ({ title, fileSize, setStartDownload, hasBackButton }) => {
  return (
    <Container>
      <Header title="Téléchargement nécessaire" hasBackButton={hasBackButton} />
      <Box flex center padding={30}>
        <Box center maxWidth={300}>
          <Icon.Feather name="download-cloud" size={100} color="rgb(98,113,122)" />
          <Text textAlign="center" marginBottom={30} marginTop={30}>
            {title}
          </Text>
          <Button
            small
            title={`Télécharger (${fileSize}Mo)`}
            onPress={() => setStartDownload(true)}
          />
        </Box>
      </Box>
    </Container>
  )
}

export default DownloadRequired
