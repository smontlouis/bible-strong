import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, BackHandler, ScrollView, View } from 'react-native'
import type { TFunction } from 'i18next'

import Box, { HStack, VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import { ProgressBar } from '~common/ui/ProgressBar'
import Text from '~common/ui/Text'
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
      appLogger.error('startup', 'app_migration.inspection_failed', {
        phase: context.phase,
        error,
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
          appLogger.error('startup', 'app_migration.inspection_failed', {
            phase: context.phase,
            error,
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
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => subscription.remove()
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
      <Container flex={1} center bg="reverse" testID="migration-checking">
        <ActivityIndicator accessibilityLabel={t('Chargement...')} />
        <Text color="grey" mt={12} textAlign="center">
          {t('Chargement...')}
        </Text>
      </Container>
    )
  }

  if (state.kind === 'inspection-error') {
    return (
      <Container flex={1} center bg="reverse" px={28} testID="migration-inspection-error">
        <Box size={64} borderRadius={32} bg="lightSecondary" center mb={24}>
          <FeatherIcon name="alert-triangle" size={28} color="secondary" />
        </Box>
        <Text bold fontSize={24} textAlign="center" mb={12}>
          {t('migration.checkFailedTitle')}
        </Text>
        <Text color="grey" textAlign="center" mb={8}>
          {t('migration.checkFailedDescription')}
        </Text>
        <Text color="darkGrey" fontSize={12} textAlign="center" mb={28}>
          {state.errorCode}
        </Text>
        <Box width="100%" maxWidth={420}>
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
    <Container flex={1} bg="reverse" isPadding={false} testID="migration-gate">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 }}
        bounces={false}
      >
        <VStack flex={1} width="100%" maxWidth={560} alignSelf="center" justifyContent="center">
          <Box alignSelf="center" px={12} py={6} borderRadius={16} bg="lightPrimary" mb={22}>
            <Text color="primary" bold fontSize={12}>
              {t('migration.requiredBadge')}
            </Text>
          </Box>

          <Box
            size={72}
            borderRadius={24}
            bg={hasFailure ? 'lightSecondary' : 'lightPrimary'}
            center
          >
            <FeatherIcon
              name={hasFailure ? 'wifi-off' : isWorking ? 'download-cloud' : 'refresh-cw'}
              size={32}
              color={hasFailure ? 'secondary' : 'primary'}
            />
          </Box>

          <Text bold fontSize={28} mt={22} lineHeight={34}>
            {hasFailure
              ? t('migration.failedTitle')
              : isWorking
                ? t('migration.runningTitle')
                : t('migration.legacyResourcesTitle')}
          </Text>
          <Text color="grey" mt={10} lineHeight={23}>
            {hasFailure
              ? t('migration.failedDescription')
              : isWorking
                ? t('migration.runningDescription')
                : t('migration.legacyResourcesDescription')}
          </Text>

          {isConfirmation && (
            <>
              <HStack mt={24} gap={12}>
                <Box flex={1} p={16} borderRadius={16} bg="lightGrey">
                  <Text color="darkGrey" fontSize={12}>
                    {t('migration.downloadSize')}
                  </Text>
                  <Text bold mt={4}>
                    {formatBytes(downloadBytes, i18n.language)}
                  </Text>
                </Box>
                <Box flex={1} p={16} borderRadius={16} bg="lightGrey">
                  <Text color="darkGrey" fontSize={12}>
                    {t('migration.reclaimedSpace')}
                  </Text>
                  <Text bold mt={4}>
                    {formatBytes(reclaimedBytes, i18n.language)}
                  </Text>
                </Box>
              </HStack>

              {resources.length > 0 && (
                <VStack mt={24} gap={10}>
                  <Text bold fontSize={14}>
                    {t('migration.resourcesToInstall')}
                  </Text>
                  {resources.map(resource => (
                    <HStack key={resource.id} alignItems="center" gap={10}>
                      <Box size={24} borderRadius={12} bg="lightPrimary" center>
                        <FeatherIcon name="download" size={13} color="primary" />
                      </Box>
                      <Text flex={1} fontSize={14}>
                        {getLocalizedResourceLabel(resource.resourceId, resource.label, t)}
                      </Text>
                    </HStack>
                  ))}
                  <Box mt={8} p={16} borderRadius={16} bg="lightGrey">
                    <Text color="grey" fontSize={13} lineHeight={19}>
                      {t('migration.useOnlineDescription')}
                    </Text>
                  </Box>
                </VStack>
              )}
            </>
          )}

          {isWorking && (
            <VStack mt={28} gap={10}>
              <HStack alignItems="center" justifyContent="space-between">
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
              {currentStep && (
                <Text color="darkGrey" fontSize={12}>
                  {t(currentStep)}
                  {snapshot.message ? ` · ${t(snapshot.message)}` : ''}
                </Text>
              )}
            </VStack>
          )}

          {hasFailure && (
            <Box mt={24} p={16} bg="lightGrey" borderRadius={16}>
              <Text color="grey" fontSize={13} lineHeight={19}>
                {t('migration.continueWithoutWarning')}
              </Text>
              {snapshot.errorCode && (
                <Text color="darkGrey" fontSize={11} mt={8}>
                  {snapshot.errorCode}
                </Text>
              )}
            </Box>
          )}

          <VStack mt={32} gap={12}>
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
