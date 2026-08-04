import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import type { AccountMigrationPresentation } from '../../../helpers/useAccountMigrations'
import AccountMigrationModal from '../AccountMigrationModal'

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    ActivityIndicator: (props: Record<string, unknown>) =>
      React.createElement('ActivityIndicator', props),
    Modal: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('Modal', props, children),
    View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('View', props, children),
  }
})

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('~common/ui/Box', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const Component = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('Box', props, children)
  return { __esModule: true, default: Component, HStack: Component, VStack: Component }
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

const activePresentation = (
  status: 'running' | 'failed',
  overrides: Record<string, unknown> = {}
): AccountMigrationPresentation =>
  ({
    kind: status === 'failed' ? 'failed' : 'active',
    errorCode: status === 'failed' ? 'FIRESTORE_EMBEDDED_DATA_MIGRATION_FAILED' : undefined,
    snapshot: {
      status,
      migrationId: 'firestore-embedded-user-data',
      migrationVersion: 1,
      plan: {
        steps: [
          {
            id: 'migrate-embedded-data',
            label: 'migration.account.embedded.step',
          },
        ],
      },
      completedStepIds: [],
      completedCleanupStepIds: [],
      currentStepId: 'migrate-embedded-data',
      progress: 0.4,
      isResuming: false,
      ...overrides,
    },
  }) as AccountMigrationPresentation

const renderModal = (presentation: AccountMigrationPresentation) => {
  let renderer: ReactTestRenderer
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  act(() => {
    renderer = create(
      <AccountMigrationModal
        presentation={presentation}
        isActionPending={false}
        onRetry={jest.fn()}
        onContinue={jest.fn()}
      />
    )
  })
  consoleError.mockRestore()
  return renderer!
}

describe('AccountMigrationModal', () => {
  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  it('renders no surface when account migrations are idle', () => {
    expect(renderModal({ kind: 'hidden' }).toJSON()).toBeNull()
  })

  it('blocks interactions with a lightweight sync check before the account is declared clean', () => {
    const renderer = renderModal({ kind: 'checking' })

    expect(renderer.root.findByProps({ testID: 'account-migration-checking' })).toBeTruthy()
    expect(renderer.root.findAllByProps({ testID: 'account-migration-modal' })).toHaveLength(0)
  })

  it('shows generic orchestrator progress without a migration-specific branch', () => {
    const renderer = renderModal(activePresentation('running'))

    expect(renderer.root.findByProps({ testID: 'account-migration-modal' })).toBeTruthy()
    expect(renderer.root.findByProps({ accessibilityRole: 'progressbar' }).props).toMatchObject({
      accessibilityValue: { min: 0, max: 100, now: 40 },
    })
    expect(renderer.root.findAllByProps({ testID: 'account-migration-retry' })).toHaveLength(0)
  })

  it('offers retry and an explicit continuation only after failure', () => {
    const renderer = renderModal(activePresentation('failed'))

    expect(renderer.root.findByProps({ testID: 'account-migration-retry' })).toBeTruthy()
    expect(renderer.root.findByProps({ testID: 'account-migration-continue' })).toBeTruthy()
    expect(
      renderer.root.findByProps({ testID: 'account-migration-error-code' }).props.children
    ).toBe('FIRESTORE_EMBEDDED_DATA_MIGRATION_FAILED')
  })
})
