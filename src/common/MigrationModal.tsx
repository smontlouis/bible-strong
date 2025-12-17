import React from 'react'
import { Linking, ActivityIndicator } from 'react-native'
import Modal from 'react-native-modal'
import styled from '@emotion/native'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Button from '~common/ui/Button'
import { ProgressBar } from '~common/ui/ProgressBar'
import { FeatherIcon } from '~common/ui/Icon'
import { Theme } from '~themes'
import { migrationProgressAtom } from 'src/state/migration'

const ModalContent = styled.View(({ theme }: { theme: Theme }) => ({
  flex: 1,
  backgroundColor: theme.colors.reverse,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 30,
}))

const IconContainer = styled.View(({ theme }: { theme: Theme }) => ({
  width: 100,
  height: 100,
  borderRadius: 50,
  backgroundColor: theme.colors.lightPrimary,
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 30,
}))

const ErrorBox = styled.View(({ theme }: { theme: Theme }) => ({
  backgroundColor: theme.colors.lightGrey,
  padding: 15,
  borderRadius: 10,
  marginBottom: 20,
  width: '100%',
}))

const SUPPORT_EMAIL = 'smontlouis.music@gmail.com'

const MigrationModal = () => {
  const { t } = useTranslation()
  const progress = useAtomValue(migrationProgressAtom)

  const handleContactSupport = () => {
    const subject = encodeURIComponent('Bible Strong - Migration Issue')
    const body = encodeURIComponent(
      `Bonjour,\n\nJ'ai rencontré un problème lors de la migration de mes données.\n\nCollections échouées: ${
        progress.failedCollections.join(', ') || 'N/A'
      }\nErreur: ${progress.error || 'N/A'}\n\nMerci de votre aide.`
    )
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`)
  }

  if (!progress.isActive) {
    return null
  }

  const hasError = progress.error !== null

  return (
    <Modal
      isVisible={progress.isActive}
      backdropOpacity={0.9}
      style={{ margin: 0 }}
      coverScreen={true}
      animationIn="fadeIn"
      animationOut="fadeOut"
    >
      <ModalContent>
        <IconContainer>
          <FeatherIcon name={hasError ? 'alert-circle' : 'database'} size={50} color="primary" />
        </IconContainer>

        <Text bold fontSize={24} textAlign="center" marginBottom={10}>
          {hasError
            ? progress.hasPartialFailure
              ? t('migration.partiallyFailed')
              : t('migration.failed')
            : progress.isResuming
              ? t('migration.resuming')
              : t('migration.inProgress')}
        </Text>

        <Text textAlign="center" color="grey" marginBottom={20}>
          {hasError ? t('migration.errorDescription') : t('migration.description')}
        </Text>

        {!hasError && (
          <Box row center marginBottom={25}>
            <FeatherIcon name="wifi" size={16} color="grey" />
            <Text marginLeft={8} fontSize={12} color="grey">
              {t('migration.internetRequired')}
            </Text>
          </Box>
        )}

        {!hasError && (
          <Box width="100%" marginBottom={30}>
            <Box marginBottom={10}>
              <ProgressBar progress={progress.overallProgress} />
            </Box>
            <Text textAlign="center" fontSize={16} bold>
              {Math.round(progress.overallProgress * 100)}%
            </Text>
            {progress.message && (
              <Text textAlign="center" fontSize={12} color="grey" marginTop={8}>
                {progress.message}
              </Text>
            )}
          </Box>
        )}

        {hasError && (
          <Box width="100%">
            <ErrorBox>
              <Text fontSize={12} color="grey">
                {progress.hasPartialFailure
                  ? t('migration.partialError') + progress.failedCollections.join(', ')
                  : progress.error}
              </Text>
            </ErrorBox>

            <Text textAlign="center" fontSize={14} color="grey" marginBottom={20}>
              {t('migration.contactSupport')}
            </Text>

            <Button onPress={handleContactSupport} secondary>
              {t('migration.contactButton')}
            </Button>
          </Box>
        )}

        {!hasError && (
          <Box marginTop={10}>
            <ActivityIndicator size="large" color="#3498db" />
          </Box>
        )}
      </ModalContent>
    </Modal>
  )
}

export default MigrationModal
