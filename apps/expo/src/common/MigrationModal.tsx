import { useAtomValue } from 'jotai'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import * as NativeUI from 'react-native'
import { ActivityIndicator, Linking, Modal } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'

import { migrationProgressAtom } from 'src/state/migration'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import { ProgressBar } from '~common/ui/ProgressBar'
import Text from '~common/ui/Text'
import { getCollectionLabel } from '~helpers/firestoreMigration'
import type { SubcollectionName } from '~helpers/firestoreSubcollections'
import { Theme } from '~themes'

const ModalContent = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, keyof { theme: Theme } | 'theme'> &
    Omit<{ theme: Theme }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('flex-[1] bg-reverse justify-center items-center p-[30px]', className)
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const IconContainer = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, keyof { theme: Theme } | 'theme'> &
    Omit<{ theme: Theme }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge(
      'w-[100px] h-[100px] rounded-[50px] bg-light-primary justify-center items-center mb-[30px]',
      className
    )
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const ErrorBox = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, keyof { theme: Theme } | 'theme'> &
    Omit<{ theme: Theme }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('bg-light-grey p-[15px] rounded-[10px] mb-[20px] w-[100%]', className)
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const Backdrop = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('flex-[1] bg-[rgba(0,0,0,0.9)]', className))
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const SUPPORT_EMAIL = 'smontlouis.music@gmail.com'

const MigrationModal = () => {
  const { t } = useTranslation()
  const progress = useAtomValue(migrationProgressAtom)

  const isBibleMigration = progress.type === 'bible'

  const handleContactSupport = () => {
    const subject = encodeURIComponent('Bible Strong - Migration Issue')
    const failedLabels = isBibleMigration
      ? progress.failedCollections.join(', ')
      : progress.failedCollections.map(c => getCollectionLabel(c as SubcollectionName)).join(', ')
    const body = encodeURIComponent(
      `Bonjour,\n\nJ'ai rencontré un problème lors de la migration de mes données.\n\nCollections échouées: ${
        failedLabels || 'N/A'
      }\nErreur: ${progress.error || 'N/A'}\n\nMerci de votre aide.`
    )
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`)
  }

  if (!progress.isActive) {
    return null
  }

  const hasError = progress.error !== null

  return (
    <Modal visible={progress.isActive} animationType="fade" transparent statusBarTranslucent>
      <Backdrop accessibilityViewIsModal>
        <ModalContent>
          <IconContainer>
            <FeatherIcon name={hasError ? 'alert-circle' : 'database'} size={50} color="primary" />
          </IconContainer>

          <Text className="font-bold text-[24px] text-center mb-[10px]">
            {hasError
              ? progress.hasPartialFailure
                ? t('migration.partiallyFailed')
                : t('migration.failed')
              : isBibleMigration
                ? 'Migration des données...'
                : progress.isResuming
                  ? t('migration.resuming')
                  : t('migration.inProgress')}
          </Text>

          <Text className="text-center text-grey mb-[20px]">
            {hasError
              ? t('migration.errorDescription')
              : isBibleMigration
                ? 'Veuillez patienter, cette opération ne prendra que quelques instants.'
                : t('migration.description')}
          </Text>

          {!hasError && !isBibleMigration && (
            <Box className="overflow-hidden border-continuous flex-row items-center justify-center mb-[25px]">
              <FeatherIcon name="wifi" size={16} color="grey" />
              <Text className="ml-[8px] text-[12px] text-grey">
                {t('migration.internetRequired')}
              </Text>
            </Box>
          )}

          {!hasError && (
            <Box className="overflow-hidden border-continuous w-[100%] mb-[30px]">
              <Box
                className="overflow-hidden border-continuous mb-[10px]"
                accessible
                accessibilityLabel={t('migration.progress')}
                accessibilityRole="progressbar"
                accessibilityValue={{
                  min: 0,
                  max: 100,
                  now: Math.round(progress.overallProgress * 100),
                }}
              >
                <ProgressBar progress={progress.overallProgress} />
              </Box>
              <Text className="text-center text-[16px] font-bold">
                {Math.round(progress.overallProgress * 100)}%
              </Text>
              {progress.message && (
                <Text
                  className="text-center text-[12px] text-grey mt-[8px]"
                  accessibilityLiveRegion="polite"
                >
                  {progress.message}
                </Text>
              )}
            </Box>
          )}

          {hasError && (
            <Box className="overflow-hidden border-continuous w-[100%]">
              <ErrorBox>
                <Text className="text-[12px] text-grey">
                  {progress.hasPartialFailure
                    ? t('migration.partialError') +
                      (isBibleMigration
                        ? progress.failedCollections.join(', ')
                        : progress.failedCollections
                            .map(c => getCollectionLabel(c as SubcollectionName))
                            .join(', '))
                    : progress.error}
                </Text>
              </ErrorBox>

              <Text className="text-center text-[14px] text-grey mb-[20px]">
                {t('migration.contactSupport')}
              </Text>

              <Button onPress={handleContactSupport} secondary>
                {t('migration.contactButton')}
              </Button>
            </Box>
          )}

          {!hasError && (
            <Box className="overflow-hidden border-continuous mt-[10px]">
              <ActivityIndicator size="large" color="#3498db" />
            </Box>
          )}
        </ModalContent>
      </Backdrop>
    </Modal>
  )
}

export default MigrationModal
