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
  iconSize?: number
  size?: 'small' | 'large'
  hasHeader?: boolean
  hasBackground?: boolean
}

const DownloadRequired = ({
  title,
  fileSize,
  setStartDownload,
  hasBackButton,
  iconSize = 100,
  size = 'large',
  hasHeader,
  hasBackground,
}: Props) => {
  const padding = size === 'small' ? 10 : 30
  const { t } = useTranslation()
  return (
    <Container isSafe={size === 'large'}>
      {hasHeader && <Header title={t('Téléchargement nécessaire')} hasBackButton={hasBackButton} />}
      <Box flex center padding={padding}>
        <Box center maxWidth={300}>
          <Icon.Feather
            name="download-cloud"
            size={size === 'small' ? 20 : iconSize}
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
