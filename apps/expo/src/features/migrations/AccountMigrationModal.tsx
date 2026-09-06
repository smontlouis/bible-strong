import { twMerge } from '~common/ui/classNames'

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
        className="overflow-hidden border-continuous flex-[1] items-center justify-center bg-reverse px-[30px] py-[40px]"
        accessibilityViewIsModal
        testID="account-migration-modal"
      >
        <VStack className="overflow-hidden border-continuous w-[100%] max-w-[520px] items-center">
          <Box
            className={twMerge(
              'overflow-hidden border-continuous',
              twMerge(
                isFailure ? 'bg-light-secondary' : 'bg-light-primary',
                'overflow-hidden border-continuous rounded-[44px] items-center justify-center mb-[28px]'
              )
            )}
            style={{ width: 88, height: 88 }}
          >
            <FeatherIcon
              name={isFailure ? 'cloud-off' : 'cloud'}
              size={42}
              color={isFailure ? 'secondary' : 'primary'}
            />
          </Box>

          <Text className="font-bold text-[26px] text-center mb-[10px]">
            {isFailure ? t('migration.account.failedTitle') : t('migration.account.title')}
          </Text>
          <Text className="text-grey text-center leading-[22px] mb-[26px]">
            {isFailure
              ? t('migration.account.failedDescription')
              : t('migration.account.description')}
          </Text>

          {!isFailure && presentation.kind === 'active' && (
            <VStack className="overflow-hidden border-continuous w-[100%] gap-[10px]">
              <HStack className="overflow-hidden border-continuous justify-between items-center">
                <Text className="font-bold text-[14px]">{t('migration.progress')}</Text>
                <Text className="text-primary font-bold">{Math.round(progress * 100)}%</Text>
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
                <Text className="text-dark-grey text-[12px] text-center">
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
            <VStack className="overflow-hidden border-continuous w-[100%] gap-[12px]">
              <Box className="overflow-hidden border-continuous p-[14px] rounded-[12px] bg-light-grey">
                <Text
                  className="text-dark-grey text-[12px] text-center"
                  testID="account-migration-error-code"
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
