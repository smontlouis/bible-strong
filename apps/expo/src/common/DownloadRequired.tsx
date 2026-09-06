import { twMerge } from '~common/ui/classNames'

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
      <Box
        className="overflow-hidden border-continuous flex-[1] items-center justify-center"
        style={{ padding: padding }}
      >
        <Box className="overflow-hidden border-continuous items-center justify-center max-w-[300px]">
          <FeatherIcon
            name={icon ?? (disabled ? 'wifi-off' : 'download-cloud')}
            size={size === 'small' ? 20 : iconSize}
            color="tertiary"
          />
          <Text className="text-center" style={{ marginTop: padding, marginBottom: padding }}>
            {title}
          </Text>
          <Text
            className={twMerge(disabled ? 'text-tertiary' : 'text-primary', 'font-bold')}
            onPress={disabled ? undefined : onDownload}
            style={{ opacity: disabled ? 0.75 : 1 }}
          >
            {actionLabel ?? `${t('Télécharger')} (${fileSize}Mo)`}
          </Text>
          {secondaryActions.map(action => (
            <Text
              className="font-bold text-primary mt-[12px]"
              key={action.label}
              onPress={action.onPress}
            >
              {action.label}
            </Text>
          ))}
        </Box>
      </Box>
    </Container>
  )
}

export default DownloadRequired
