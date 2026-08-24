import { Modal, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import Box, { HStack, VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import { ProgressBar } from '~common/ui/ProgressBar'
import Text from '~common/ui/Text'
import type { AccountMigrationPresentation } from '~helpers/useAccountMigrations'

interface AccountMigrationModalProps {
  presentation: AccountMigrationPresentation
  isActionPending: boolean
  onConfirm(): void
  onRetry(): void
  onContinue(): void
}

const getOverallProgress = (presentation: AccountMigrationPresentation): number => {
  if (presentation.kind !== 'active' && presentation.kind !== 'failed') return 0
  const snapshot = presentation.snapshot
  if (!snapshot) return 0
  const totalSteps = snapshot.plan.steps.length + (snapshot.plan.cleanupSteps?.length ?? 0)
  if (totalSteps === 0) return 1
  const completedSteps = snapshot.completedStepIds.length + snapshot.completedCleanupStepIds.length
  const currentProgress = snapshot.status === 'running' ? (snapshot.progress ?? 0) : 0
  return Math.min(1, (completedSteps + currentProgress) / totalSteps)
}

const getCurrentStepLabel = (presentation: AccountMigrationPresentation): string | undefined => {
  if (presentation.kind !== 'active' && presentation.kind !== 'failed') return undefined
  const snapshot = presentation.snapshot
  if (!snapshot) return undefined
  if (snapshot.currentCleanupStepId) {
    return snapshot.plan.cleanupSteps?.find(step => step.id === snapshot.currentCleanupStepId)
      ?.label
  }
  if (snapshot.currentStepId && snapshot.currentStepId !== '__finalize__') {
    return snapshot.plan.steps.find(step => step.id === snapshot.currentStepId)?.label
  }
  return undefined
}

const AccountMigrationModal = ({
  presentation,
  isActionPending,
  onConfirm,
  onRetry,
  onContinue,
}: AccountMigrationModalProps) => {
  const { t } = useTranslation()

  if (presentation.kind === 'hidden' || presentation.kind === 'checking') return null

  const isFailure = presentation.kind === 'failed'
  const progress = getOverallProgress(presentation)
  const currentStepLabel = getCurrentStepLabel(presentation)
  const isConfirmation =
    presentation.kind === 'active' &&
    (presentation.snapshot.status === 'detected' ||
      presentation.snapshot.status === 'awaiting-confirmation')

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <Box
        accessibilityViewIsModal
        flex={1}
        center
        bg="reverse"
        px={30}
        py={40}
        testID="account-migration-modal"
      >
        <VStack width="100%" maxWidth={520} alignItems="center">
          <Box
            size={88}
            borderRadius={44}
            bg={isFailure ? 'lightSecondary' : 'lightPrimary'}
            center
            mb={28}
          >
            <FeatherIcon
              name={isFailure ? 'cloud-off' : 'cloud'}
              size={42}
              color={isFailure ? 'secondary' : 'primary'}
            />
          </Box>

          <Text bold fontSize={26} textAlign="center" mb={10}>
            {isFailure ? t('migration.account.failedTitle') : t('migration.account.title')}
          </Text>
          <Text color="grey" textAlign="center" lineHeight={22} mb={26}>
            {isFailure
              ? t('migration.account.failedDescription')
              : t('migration.account.description')}
          </Text>

          {!isFailure && presentation.kind === 'active' && (
            <VStack width="100%" gap={10}>
              <HStack justifyContent="space-between" alignItems="center">
                <Text bold fontSize={14}>
                  {t('migration.progress')}
                </Text>
                <Text color="primary" bold>
                  {Math.round(progress * 100)}%
                </Text>
              </HStack>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={t('migration.progress')}
                accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
              >
                <ProgressBar progress={progress} />
              </View>
              {currentStepLabel && (
                <Text color="darkGrey" fontSize={12} textAlign="center">
                  {t(currentStepLabel)}
                </Text>
              )}
              {isConfirmation && (
                <Button
                  testID="account-migration-confirm"
                  isLoading={isActionPending}
                  onPress={onConfirm}
                >
                  {t('migration.start')}
                </Button>
              )}
            </VStack>
          )}

          {isFailure && (
            <VStack width="100%" gap={12}>
              <Box p={14} borderRadius={12} bg="lightGrey">
                <Text
                  testID="account-migration-error-code"
                  color="darkGrey"
                  fontSize={12}
                  textAlign="center"
                >
                  {presentation.errorCode}
                </Text>
              </Box>
              <Button
                testID="account-migration-retry"
                isLoading={isActionPending}
                onPress={onRetry}
              >
                {t('migration.retry')}
              </Button>
              <Button
                testID="account-migration-continue"
                disabled={isActionPending}
                secondary
                onPress={onContinue}
              >
                {t('migration.account.continue')}
              </Button>
            </VStack>
          )}
        </VStack>
      </Box>
    </Modal>
  )
}

export default AccountMigrationModal
