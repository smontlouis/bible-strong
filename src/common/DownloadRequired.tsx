import React from 'react'
import * as Icon from '@expo/vector-icons'

import Header from '~common/Header'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useTranslation } from 'react-i18next'

interface Props {
  title: string
  fileSize: number
  setStartDownload: (value: boolean) => void
  hasBackButton?: boolean
  size?: number
  small?: boolean
  noHeader?: boolean
}

const DownloadRequired = ({
  title,
  fileSize,
  setStartDownload,
  hasBackButton,
  size = 100,
  small,
  noHeader,
}: Props) => {
  const padding = small ? 10 : 30
  const iconSize = small ? 20 : size
  const { t } = useTranslation()
  return (
    <Container pure={small} noPadding={small}>
      {!noHeader && (
        <Header
          title={t('Téléchargement nécessaire')}
          hasBackButton={hasBackButton}
        />
      )}
      <Box flex center padding={padding}>
        <Box center maxWidth={300}>
          <Icon.Feather
            name="download-cloud"
            size={iconSize}
            color="rgb(98,113,122)"
          />
          <Text textAlign="center" marginBottom={padding} marginTop={padding}>
            {title}
          </Text>
          <Text bold color="primary" onPress={() => setStartDownload(true)}>
            {`${t('Télécharger')} (${fileSize}Mo)`}
          </Text>
        </Box>
      </Box>
    </Container>
  )
}

export default DownloadRequired
