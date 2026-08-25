import React, { type ComponentProps } from 'react'

import Header from '~common/Header'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useTranslation } from 'react-i18next'

interface Props {
  title: string
  fileSize: number
  onDownload: () => void
  hasBackButton?: boolean
  iconSize?: number
  size?: 'small' | 'large'
  hasHeader?: boolean
  hasBackground?: boolean
  disabled?: boolean
  actionLabel?: string
  icon?: ComponentProps<typeof FeatherIcon>['name']
  secondaryActions?: { label: string; onPress: () => void }[]
}

const DownloadRequired = ({
  title,
  fileSize,
  onDownload,
  hasBackButton,
  iconSize = 100,
  size = 'large',
  hasHeader,
  hasBackground,
  disabled = false,
  actionLabel,
  icon,
  secondaryActions = [],
}: Props) => {
  const padding = size === 'small' ? 10 : 30
  const { t } = useTranslation()
  return (
    <Container isSafe={size === 'large'}>
      {hasHeader && (
        <Header title={t('resource.offlineCopy.title')} hasBackButton={hasBackButton} />
      )}
      <Box flex center padding={padding}>
        <Box center maxWidth={300}>
          <FeatherIcon
            name={icon ?? (disabled ? 'wifi-off' : 'download-cloud')}
            size={size === 'small' ? 20 : iconSize}
            color="tertiary"
          />
          <Text textAlign="center" marginBottom={padding} marginTop={padding}>
            {title}
          </Text>
          <Text
            bold
            color={disabled ? 'tertiary' : 'primary'}
            opacity={disabled ? 0.75 : 1}
            onPress={disabled ? undefined : onDownload}
          >
            {actionLabel ?? `${t('Télécharger')} (${fileSize}Mo)`}
          </Text>
          {secondaryActions.map(action => (
            <Text key={action.label} bold color="primary" marginTop={12} onPress={action.onPress}>
              {action.label}
            </Text>
          ))}
        </Box>
      </Box>
    </Container>
  )
}

export default DownloadRequired
