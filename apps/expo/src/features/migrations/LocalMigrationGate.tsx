import { twMerge } from '~common/ui/classNames'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import type { TFunction } from 'i18next'
import Box, { HStack, VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import { ProgressBar } from '~common/ui/ProgressBar'
import Text from '~common/ui/Text'
import { subscribeToHardwareBackPress } from '~helpers/hardwareBackPress'
import { appLogger } from '~helpers/agentObservability'
import {
  localMigrationContext,
  localMigrationOrchestrator,
  prepareLocalMigrationInspection,
} from '../../migrations/localMigrationRegistry'
import type {
  AppMigrationOrchestrator,
  MigrationContext,
  MigrationSnapshot,
  MigrationSnapshotListener,
} from '../../migrations/appMigrationOrchestrator'
type ActiveMigrationSnapshot = Exclude<MigrationSnapshot, { status: 'idle' }>

type GateState =
  | { kind: 'checking' }
  | { kind: 'ready' }
  | { kind: 'blocked'; snapshot: ActiveMigrationSnapshot }
  | { kind: 'inspection-error'; errorCode: string }

interface LocalMigrationGateProps {
  children: React.ReactNode
  orchestrator?: AppMigrationOrchestrator
  context?: MigrationContext
  prepareInspection?: () => Promise<void>
}

const isTerminal = (snapshot: MigrationSnapshot): boolean =>
  snapshot.status === 'completed' || snapshot.status === 'abandoned-after-failure'

const getErrorCode = (error: unknown): string =>
  error instanceof Error ? error.message : 'APP_MIGRATION_UNEXPECTED_ERROR'

const inspectUntilBlocked = async (
  orchestrator: AppMigrationOrchestrator,
  context: MigrationContext,
  onChange: MigrationSnapshotListener,
  prepareInspection: () => Promise<void>
): Promise<MigrationSnapshot> => {
  await prepareInspection()
  let snapshot = await orchestrator.inspect(context)
  while (isTerminal(snapshot)) snapshot = await orchestrator.inspect(context)
  if (snapshot.status === 'idle') return snapshot

  onChange(snapshot)
  if (snapshot.status === 'running') {
    const resumed = await orchestrator.run(context, onChange)
    return isTerminal(resumed)
      ? inspectUntilBlocked(orchestrator, context, onChange, prepareInspection)
      : resumed
  }
  if (snapshot.status === 'abandoning-after-failure') {
    const resumed = await orchestrator.abandon(context, onChange)
    return isTerminal(resumed)
      ? inspectUntilBlocked(orchestrator, context, onChange, prepareInspection)
      : resumed
  }
  return snapshot
}

const formatBytes = (bytes: number, language: string): string => {
  if (bytes <= 0) return '—'
  const units = language.startsWith('fr') ? ['o', 'Ko', 'Mo', 'Go'] : ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value)} ${
    units[unitIndex]
  }`
}

const getOverallProgress = (snapshot: ActiveMigrationSnapshot): number => {
  const totalSteps = snapshot.plan.steps.length + (snapshot.plan.cleanupSteps?.length ?? 0)
  if (totalSteps === 0) return 1
  const completedSteps = snapshot.completedStepIds.length + snapshot.completedCleanupStepIds.length
  const currentProgress = snapshot.status === 'running' ? (snapshot.progress ?? 0) : 0
  return Math.min(1, (completedSteps + currentProgress) / totalSteps)
}

const getCurrentStepLabel = (snapshot: ActiveMigrationSnapshot): string | undefined => {
  if (snapshot.currentCleanupStepId) {
    return snapshot.plan.cleanupSteps?.find(step => step.id === snapshot.currentCleanupStepId)
      ?.label
  }
  if (snapshot.currentStepId && snapshot.currentStepId !== '__finalize__') {
    return snapshot.plan.steps.find(step => step.id === snapshot.currentStepId)?.label
  }
  return snapshot.currentStepId === '__finalize__' ? 'migration.finalizing' : undefined
}

const getLocalizedResourceLabel = (
  resourceId: string | undefined,
  fallback: string,
  t: TFunction
): string => {
  if (!resourceId) return fallback
  let identity: Record<string, unknown> | undefined
  try {
    const parsed = JSON.parse(resourceId) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      identity = parsed as Record<string, unknown>
    }
  } catch {}

  if (identity?.kind === 'interlinear-index' && typeof identity.language === 'string') {
    return t('migration.resource.interlinear', { language: identity.language.toUpperCase() })
  }
  if (resourceId.startsWith('bible-interlinear:')) {
    const language = resourceId.split(':').at(-1)?.toUpperCase() ?? ''
    return t('migration.resource.interlinear', { language })
  }
  const lexiconModule =
    identity?.kind === 'strong-lexicon-module' && typeof identity.moduleId === 'string'
      ? identity.moduleId
      : resourceId.startsWith('strong-lexicon:')
        ? resourceId.split(':').at(-1)
        : undefined
  if (lexiconModule && ['core', 'resources', 'entities'].includes(lexiconModule)) {
    return t(`migration.resource.strongLexicon.${lexiconModule}`)
  }
  return fallback
}

const LocalMigrationGate = ({
  children,
  orchestrator = localMigrationOrchestrator,
  context = localMigrationContext,
  prepareInspection = prepareLocalMigrationInspection,
}: LocalMigrationGateProps) => {
  const { t, i18n } = useTranslation()
  const [startupDisposition] = useState(() => {
    try {
      return orchestrator.getStartupDisposition(context)
    } catch (error) {
      return { kind: 'error' as const, errorCode: getErrorCode(error) }
    }
  })
  const [state, setState] = useState<GateState>(() => {
    if (startupDisposition.kind === 'ready') return { kind: 'ready' }
    if (startupDisposition.kind === 'resume') {
      return { kind: 'blocked', snapshot: startupDisposition.snapshot }
    }
    if (startupDisposition.kind === 'error') {
      return { kind: 'inspection-error', errorCode: startupDisposition.errorCode }
    }
    return { kind: 'checking' }
  })
  const [actionPending, setActionPending] = useState(false)

  const showSnapshot: MigrationSnapshotListener = snapshot => {
    if (snapshot.status === 'idle') {
      setState({ kind: 'ready' })
    } else {
      setState({ kind: 'blocked', snapshot })
    }
  }

  const applyInspectionResult = (snapshot: MigrationSnapshot): void => {
    if (snapshot.status === 'idle') {
      setState({ kind: 'ready' })
    } else {
      setState({ kind: 'blocked', snapshot })
    }
  }

  const inspectGate = async (): Promise<void> => {
    const startedAt = Date.now()
    try {
      applyInspectionResult(
        await inspectUntilBlocked(orchestrator, context, showSnapshot, prepareInspection)
      )
      appLogger.info('startup', 'app_migration.inspection_completed', {
        phase: context.phase,
        durationMs: Date.now() - startedAt,
      })
    } catch (error) {
      appLogger.captureError('startup', 'app_migration.inspection_failed', error, {
        phase: context.phase,
      })
      setState({ kind: 'inspection-error', errorCode: getErrorCode(error) })
    }
  }

  const retryInspection = async (): Promise<void> => {
    setActionPending(true)
    await inspectGate().finally(() => setActionPending(false))
  }

  useEffect(() => {
    if (startupDisposition.kind === 'ready') {
      appLogger.info('startup', 'app_migration.fast_path', { phase: context.phase })
      return
    }
    if (startupDisposition.kind === 'error') return
    let active = true
    const onChange: MigrationSnapshotListener = snapshot => {
      if (!active) return
      if (snapshot.status === 'idle') setState({ kind: 'ready' })
      else setState({ kind: 'blocked', snapshot })
    }

    inspectUntilBlocked(orchestrator, context, onChange, prepareInspection)
      .then(snapshot => {
        if (!active) return
        if (snapshot.status === 'idle') setState({ kind: 'ready' })
        else setState({ kind: 'blocked', snapshot })
      })
      .catch(error => {
        if (active) {
          appLogger.captureError('startup', 'app_migration.inspection_failed', error, {
            phase: context.phase,
          })
          setState({ kind: 'inspection-error', errorCode: getErrorCode(error) })
        }
      })

    return () => {
      active = false
    }
  }, [orchestrator, context, prepareInspection, startupDisposition.kind])

  useEffect(() => {
    if (state.kind === 'ready') return
    return subscribeToHardwareBackPress(() => true)
  }, [state.kind])

  const runMigration = async (onlineOnly = false): Promise<void> => {
    setActionPending(true)
    try {
      const result = onlineOnly
        ? await orchestrator.run(context, showSnapshot, { mode: 'online-only' })
        : await orchestrator.run(context, showSnapshot)
      if (isTerminal(result)) await inspectGate()
      else applyInspectionResult(result)
    } catch (error) {
      setState({ kind: 'inspection-error', errorCode: getErrorCode(error) })
    } finally {
      setActionPending(false)
    }
  }

  const abandonMigration = async (): Promise<void> => {
    setActionPending(true)
    try {
      const result = await orchestrator.abandon(context, showSnapshot)
      if (isTerminal(result)) await inspectGate()
      else applyInspectionResult(result)
    } catch (error) {
      setState({ kind: 'inspection-error', errorCode: getErrorCode(error) })
    } finally {
      setActionPending(false)
    }
  }

  if (state.kind === 'ready') return children

  if (state.kind === 'checking') {
    return (
      <Container
        className="flex-[1] bg-reverse items-center justify-center"
        testID="migration-checking"
      >
        <ActivityIndicator accessibilityLabel={t('Chargement...')} />
        <Text className="text-grey mt-[12px] text-center">{t('Chargement...')}</Text>
      </Container>
    )
  }

  if (state.kind === 'inspection-error') {
    return (
      <Container
        className="px-[28px] flex-[1] bg-reverse items-center justify-center"
        testID="migration-inspection-error"
      >
        <Box
          className="overflow-hidden border-continuous rounded-[32px] bg-light-secondary items-center justify-center mb-[24px]"
          style={{ width: 64, height: 64 }}
        >
          <FeatherIcon name="alert-triangle" size={28} color="secondary" />
        </Box>
        <Text className="font-bold text-[24px] text-center mb-[12px]">
          {t('migration.checkFailedTitle')}
        </Text>
        <Text className="text-grey text-center mb-[8px]">
          {t('migration.checkFailedDescription')}
        </Text>
        <Text className="text-dark-grey text-[12px] text-center mb-[28px]">{state.errorCode}</Text>
        <Box className="overflow-hidden border-continuous w-[100%] max-w-[420px]">
          <Button
            testID="migration-check-retry"
            isLoading={actionPending}
            onPress={retryInspection}
          >
            {t('migration.retry')}
          </Button>
        </Box>
      </Container>
    )
  }

  const { snapshot } = state
  const isConfirmation =
    snapshot.status === 'detected' || snapshot.status === 'awaiting-confirmation'
  const isFailure = snapshot.status === 'failed'
  const isAbandonFailure =
    snapshot.status === 'abandoning-after-failure' && Boolean(snapshot.errorCode)
  const hasFailure = isFailure || isAbandonFailure
  const isWorking = snapshot.status === 'running' || snapshot.status === 'abandoning-after-failure'
  const resources = snapshot.plan.steps.filter(step => step.id.startsWith('install:'))
  const downloadBytes = Number(snapshot.plan.metadata?.estimatedDownloadBytes ?? 0)
  const reclaimedBytes = Number(snapshot.plan.metadata?.reclaimedBytes ?? 0)
  const progress = getOverallProgress(snapshot)
  const currentStep = getCurrentStepLabel(snapshot)

  return (
    <Container className="flex-[1] bg-reverse" isPadding={false} testID="migration-gate">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 }}
        bounces={false}
      >
        <VStack className="overflow-hidden border-continuous flex-[1] w-[100%] max-w-[560px] self-center justify-center">
          <Box className="overflow-hidden border-continuous self-center px-[12px] py-[6px] rounded-[16px] bg-light-primary mb-[22px]">
            <Text className="text-primary font-bold text-[12px]">
              {t('migration.requiredBadge')}
            </Text>
          </Box>

          <Box
            className={twMerge(
              'overflow-hidden border-continuous',
              twMerge(
                hasFailure ? 'bg-light-secondary' : 'bg-light-primary',
                'overflow-hidden border-continuous rounded-[24px] items-center justify-center'
              )
            )}
            style={{ width: 72, height: 72 }}
          >
            <FeatherIcon
              name={hasFailure ? 'wifi-off' : isWorking ? 'download-cloud' : 'refresh-cw'}
              size={32}
              color={hasFailure ? 'secondary' : 'primary'}
            />
          </Box>

          <Text className="font-bold text-[28px] mt-[22px] leading-[34px]">
            {hasFailure
              ? t('migration.failedTitle')
              : isWorking
                ? t('migration.runningTitle')
                : t('migration.legacyResourcesTitle')}
          </Text>
          <Text className="text-grey mt-[10px] leading-[23px]">
            {hasFailure
              ? t('migration.failedDescription')
              : isWorking
                ? t('migration.runningDescription')
                : t('migration.legacyResourcesDescription')}
          </Text>

          {isConfirmation && (
            <>
              <HStack className="overflow-hidden border-continuous mt-[24px] gap-[12px]">
                <Box className="overflow-hidden border-continuous flex-[1] p-[16px] rounded-[16px] bg-light-grey">
                  <Text className="text-dark-grey text-[12px]">{t('migration.downloadSize')}</Text>
                  <Text className="font-bold mt-[4px]">
                    {formatBytes(downloadBytes, i18n.language)}
                  </Text>
                </Box>
                <Box className="overflow-hidden border-continuous flex-[1] p-[16px] rounded-[16px] bg-light-grey">
                  <Text className="text-dark-grey text-[12px]">
                    {t('migration.reclaimedSpace')}
                  </Text>
                  <Text className="font-bold mt-[4px]">
                    {formatBytes(reclaimedBytes, i18n.language)}
                  </Text>
                </Box>
              </HStack>

              {resources.length > 0 && (
                <VStack className="overflow-hidden border-continuous mt-[24px] gap-[10px]">
                  <Text className="font-bold text-[14px]">{t('migration.resourcesToInstall')}</Text>
                  {resources.map(resource => (
                    <HStack
                      className="overflow-hidden border-continuous items-center gap-[10px]"
                      key={resource.id}
                    >
                      <Box
                        className="overflow-hidden border-continuous rounded-[12px] bg-light-primary items-center justify-center"
                        style={{ width: 24, height: 24 }}
                      >
                        <FeatherIcon name="download" size={13} color="primary" />
                      </Box>
                      <Text className="flex-[1] text-[14px]">
                        {getLocalizedResourceLabel(resource.resourceId, resource.label, t)}
                      </Text>
                    </HStack>
                  ))}
                  <Box className="overflow-hidden border-continuous mt-[8px] p-[16px] rounded-[16px] bg-light-grey">
                    <Text className="text-grey text-[13px] leading-[19px]">
                      {t('migration.useOnlineDescription')}
                    </Text>
                  </Box>
                </VStack>
              )}
            </>
          )}

          {isWorking && (
            <VStack className="overflow-hidden border-continuous mt-[28px] gap-[10px]">
              <HStack className="overflow-hidden border-continuous items-center justify-between">
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
              {currentStep !== undefined && (
                <Text className="text-dark-grey text-[12px]">
                  {t(currentStep)}
                  {snapshot.message ? ` · ${t(snapshot.message)}` : ''}
                </Text>
              )}
            </VStack>
          )}

          {hasFailure && (
            <Box className="overflow-hidden border-continuous mt-[24px] p-[16px] bg-light-grey rounded-[16px]">
              <Text className="text-grey text-[13px] leading-[19px]">
                {t('migration.continueWithoutWarning')}
              </Text>
              {snapshot.errorCode && (
                <Text className="text-dark-grey text-[11px] mt-[8px]">{snapshot.errorCode}</Text>
              )}
            </Box>
          )}

          <VStack className="overflow-hidden border-continuous mt-[32px] gap-[12px]">
            {isConfirmation && (
              <>
                <Button
                  testID="migration-start"
                  isLoading={actionPending}
                  onPress={() => runMigration()}
                >
                  {t('migration.start')}
                </Button>
                {resources.length > 0 && (
                  <Button
                    testID="migration-use-online"
                    reverse
                    disabled={actionPending}
                    onPress={() => runMigration(true)}
                  >
                    {t('migration.useOnline')}
                  </Button>
                )}
              </>
            )}
            {isFailure && (
              <>
                <Button
                  testID="migration-retry"
                  isLoading={actionPending}
                  onPress={() => runMigration()}
                >
                  {t('migration.retry')}
                </Button>
                <Button
                  testID="migration-continue-without"
                  reverse
                  disabled={actionPending}
                  onPress={abandonMigration}
                >
                  {t('migration.continueWithout')}
                </Button>
              </>
            )}
            {isAbandonFailure && (
              <Button
                testID="migration-continue-without"
                isLoading={actionPending}
                onPress={abandonMigration}
              >
                {t('migration.retryFinalization')}
              </Button>
            )}
          </VStack>
        </VStack>
      </ScrollView>
    </Container>
  )
}

export default LocalMigrationGate
