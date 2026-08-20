import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import type {
  AppMigrationOrchestrator,
  MigrationContext,
  MigrationSnapshot,
  MigrationSnapshotListener,
  MigrationStartupDisposition,
} from '../../../migrations/appMigrationOrchestrator'
import LocalMigrationGate from '../LocalMigrationGate'

let backHandler: (() => boolean) | undefined
const mockBackRemove = jest.fn()

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    ActivityIndicator: () => React.createElement('ActivityIndicator'),
    BackHandler: {
      addEventListener: (_event: string, listener: () => boolean) => {
        backHandler = listener
        return { remove: mockBackRemove }
      },
    },
    ScrollView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('ScrollView', props, children),
    View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('View', props, children),
  }
})

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}))

jest.mock('~common/ui/Box', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const Component = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('Box', props, children)
  return { __esModule: true, default: Component, HStack: Component, VStack: Component }
})

jest.mock('~common/ui/Container', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('Container', props, children)
})

jest.mock('~common/ui/Text', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('Text', props, children)
})

jest.mock('~common/ui/Button', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('Button', props, children)
})

jest.mock('~common/ui/ProgressBar', () => ({
  ProgressBar: (props: Record<string, unknown>) =>
    jest.requireActual<typeof import('react')>('react').createElement('ProgressBar', props),
}))

jest.mock('~common/ui/Icon', () => ({
  FeatherIcon: (props: Record<string, unknown>) =>
    jest.requireActual<typeof import('react')>('react').createElement('FeatherIcon', props),
}))

jest.mock('../../../migrations/localMigrationRegistry', () => ({
  localMigrationContext: { phase: 'local', scopeId: 'device' },
  localMigrationOrchestrator: {},
  prepareLocalMigrationInspection: jest.fn(async () => {}),
}))

const context: MigrationContext = { phase: 'local', scopeId: 'device' }

const migrationSnapshot = (
  status: Exclude<MigrationSnapshot['status'], 'idle'>,
  overrides: Partial<Exclude<MigrationSnapshot, { status: 'idle' }>> = {}
): Exclude<MigrationSnapshot, { status: 'idle' }> => ({
  status,
  migrationId: 'legacy-bible-resources',
  migrationVersion: 1,
  plan: {
    steps: [
      { id: 'migrate-persisted-references', label: 'migration.references' },
      { id: 'install:lsg', label: 'Louis Segond — Strong', resourceId: 'bible-strong:LSG' },
    ],
    cleanupSteps: [{ id: 'cleanup:LSGS', label: 'migration.cleanup' }],
    metadata: {
      estimatedDownloadBytes: 1000,
      reclaimedBytes: 500,
    },
  },
  completedStepIds: [],
  completedCleanupStepIds: [],
  isResuming: false,
  ...overrides,
})

const createFakeOrchestrator = ({
  inspections,
  runResult,
  abandonResult,
  startupDisposition = { kind: 'inspect' },
}: {
  inspections: MigrationSnapshot[]
  runResult?: MigrationSnapshot
  abandonResult?: MigrationSnapshot
  startupDisposition?: MigrationStartupDisposition
}): AppMigrationOrchestrator => {
  let inspectionIndex = 0
  return {
    getStartupDisposition: () => startupDisposition,
    inspect: jest.fn(async () => inspections[Math.min(inspectionIndex++, inspections.length - 1)]),
    run: jest.fn(async (_context, onChange?: MigrationSnapshotListener) => {
      const result = runResult ?? migrationSnapshot('completed')
      onChange?.(result)
      return result
    }),
    abandon: jest.fn(async (_context, onChange?: MigrationSnapshotListener) => {
      const result = abandonResult ?? migrationSnapshot('abandoned-after-failure')
      onChange?.(result)
      return result
    }),
  }
}

const noPreparation = async () => {}

const renderGate = async (
  orchestrator: AppMigrationOrchestrator,
  prepareInspection: () => Promise<void> = noPreparation
) => {
  let renderer: ReactTestRenderer
  const consoleError = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
    if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) {
      return
    }
    console.warn(message, ...args)
  })
  try {
    await act(async () => {
      renderer = create(
        <LocalMigrationGate
          context={context}
          orchestrator={orchestrator}
          prepareInspection={prepareInspection}
        >
          <React.Fragment key="app-content">Application</React.Fragment>
        </LocalMigrationGate>
      )
    })
  } finally {
    consoleError.mockRestore()
  }
  return renderer!
}

describe('LocalMigrationGate', () => {
  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    backHandler = undefined
    mockBackRemove.mockClear()
  })

  it('continues directly on a clean device', async () => {
    const orchestrator = createFakeOrchestrator({
      inspections: [{ status: 'idle', isResuming: false }],
    })

    const renderer = await renderGate(orchestrator)

    expect(renderer.toJSON()).toBe('Application')
    expect(orchestrator.run).not.toHaveBeenCalled()
  })

  it('uses the synchronous clean checkpoint without running inspection or showing migration UI', async () => {
    const orchestrator = createFakeOrchestrator({
      inspections: [{ status: 'idle', isResuming: false }],
      startupDisposition: { kind: 'ready' },
    })

    const renderer = await renderGate(orchestrator)

    expect(renderer.toJSON()).toBe('Application')
    expect(orchestrator.inspect).not.toHaveBeenCalled()
  })

  it('completes historical storage preparation before inspecting migration evidence', async () => {
    const orchestrator = createFakeOrchestrator({
      inspections: [{ status: 'idle', isResuming: false }],
    })
    const prepareInspection = jest.fn(async () => {})

    await renderGate(orchestrator, prepareInspection)

    expect(prepareInspection).toHaveBeenCalledTimes(1)
    expect(prepareInspection.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(orchestrator.inspect).mock.invocationCallOrder[0]
    )
  })

  it('blocks normal content and offers online access without downloading', async () => {
    const orchestrator = createFakeOrchestrator({
      inspections: [migrationSnapshot('awaiting-confirmation')],
    })

    const renderer = await renderGate(orchestrator)

    expect(renderer.root.findByProps({ testID: 'migration-start' })).toBeTruthy()
    expect(renderer.root.findByProps({ testID: 'migration-use-online' })).toBeTruthy()
    expect(renderer.toJSON()).not.toEqual('Application')
    expect(backHandler?.()).toBe(true)
  })

  it('migrates in online-only mode and enters the app without installing resources', async () => {
    const orchestrator = createFakeOrchestrator({
      inspections: [
        migrationSnapshot('awaiting-confirmation'),
        { status: 'idle', isResuming: false },
      ],
    })
    const renderer = await renderGate(orchestrator)

    await act(async () => {
      renderer.root.findByProps({ testID: 'migration-use-online' }).props.onPress()
    })

    expect(orchestrator.run).toHaveBeenCalledWith(context, expect.any(Function), {
      mode: 'online-only',
    })
    expect(orchestrator.abandon).not.toHaveBeenCalled()
    expect(renderer.toJSON()).toBe('Application')
  })

  it('localizes interlinear resources from their serialized migration identity', async () => {
    const orchestrator = createFakeOrchestrator({
      inspections: [
        migrationSnapshot('awaiting-confirmation', {
          plan: {
            steps: [
              {
                id: 'install:interlinear',
                label: 'BHG — Interlinéaire EN',
                resourceId: JSON.stringify({
                  kind: 'interlinear-index',
                  versionId: 'BHG',
                  language: 'en',
                }),
              },
            ],
          },
        }),
      ],
    })

    const renderer = await renderGate(orchestrator)

    expect(
      renderer.root.findAllByProps({ children: 'migration.resource.interlinear' }).length
    ).toBeGreaterThan(0)
    expect(renderer.root.findAllByProps({ children: 'BHG — Interlinéaire EN' })).toHaveLength(0)
  })

  it('runs only after confirmation and enters the app after the terminal outcome', async () => {
    const orchestrator = createFakeOrchestrator({
      inspections: [
        migrationSnapshot('awaiting-confirmation'),
        { status: 'idle', isResuming: false },
      ],
    })
    const renderer = await renderGate(orchestrator)

    await act(async () => {
      renderer.root.findByProps({ testID: 'migration-start' }).props.onPress()
    })

    expect(orchestrator.run).toHaveBeenCalledWith(context, expect.any(Function))
    expect(renderer.toJSON()).toBe('Application')
  })

  it('automatically resumes an interrupted run and exposes retry plus explicit abandonment', async () => {
    const failed = migrationSnapshot('failed', {
      currentStepId: 'install:lsg',
      errorCode: 'NETWORK_ERROR',
      isResuming: true,
    })
    const orchestrator = createFakeOrchestrator({
      inspections: [
        migrationSnapshot('running', {
          currentStepId: 'install:lsg',
          completedStepIds: ['migrate-persisted-references'],
          isResuming: true,
        }),
      ],
      runResult: failed,
    })

    const renderer = await renderGate(orchestrator)

    expect(orchestrator.run).toHaveBeenCalledTimes(1)
    expect(renderer.root.findByProps({ testID: 'migration-retry' })).toBeTruthy()
    expect(renderer.root.findByProps({ testID: 'migration-continue-without' })).toBeTruthy()
  })

  it('retries a failed migration and unlocks only after completion', async () => {
    const orchestrator = createFakeOrchestrator({
      inspections: [
        migrationSnapshot('failed', {
          currentStepId: 'install:lsg',
          errorCode: 'NETWORK_ERROR',
        }),
        { status: 'idle', isResuming: false },
      ],
    })
    const renderer = await renderGate(orchestrator)

    await act(async () => {
      renderer.root.findByProps({ testID: 'migration-retry' }).props.onPress()
    })

    expect(orchestrator.run).toHaveBeenCalledWith(context, expect.any(Function))
    expect(renderer.toJSON()).toBe('Application')
  })

  it('cleans through abandonment before allowing normal application access', async () => {
    const orchestrator = createFakeOrchestrator({
      inspections: [
        migrationSnapshot('failed', {
          currentStepId: 'install:lsg',
          errorCode: 'NETWORK_ERROR',
        }),
        { status: 'idle', isResuming: false },
      ],
    })
    const renderer = await renderGate(orchestrator)

    await act(async () => {
      renderer.root.findByProps({ testID: 'migration-continue-without' }).props.onPress()
    })

    expect(orchestrator.abandon).toHaveBeenCalledWith(context, expect.any(Function))
    expect(renderer.toJSON()).toBe('Application')
  })

  it('stays blocked when resumed abandonment cleanup fails, then unlocks after retry', async () => {
    const abandoning = migrationSnapshot('abandoning-after-failure', {
      currentStepId: '__finalize__',
      currentCleanupStepId: 'cleanup:LSGS',
      errorCode: 'CLEANUP_FAILED',
      isResuming: true,
    })
    const orchestrator = createFakeOrchestrator({
      inspections: [abandoning, { status: 'idle', isResuming: false }],
    })
    jest
      .mocked(orchestrator.abandon)
      .mockResolvedValueOnce(abandoning)
      .mockResolvedValueOnce(migrationSnapshot('abandoned-after-failure'))

    const renderer = await renderGate(orchestrator)

    expect(renderer.root.findByProps({ testID: 'migration-continue-without' })).toBeTruthy()
    expect(renderer.toJSON()).not.toEqual('Application')

    await act(async () => {
      renderer.root.findByProps({ testID: 'migration-continue-without' }).props.onPress()
    })

    expect(orchestrator.abandon).toHaveBeenCalledTimes(2)
    expect(renderer.toJSON()).toBe('Application')
  })
})
