import {
  getResourceFailurePresentation,
  resourceFailureFromAccessError,
  resourceFailureFromAvailability,
  resourceFailureFromBibleError,
  resourceFailureFromStrongModuleAvailability,
} from '../resourceFailure'
import { ResourceAccessError } from '../resourceAccessError'

describe('Resource failure presentation', () => {
  it.each([
    ['not-found', true, ['acquire-offline-copy'], 'search', [], false],
    ['not-found', false, ['acquire-offline-copy'], 'search', [], false],
    ['network-offline', true, ['retry'], 'wifi-off', ['retry'], false],
    ['network-offline', false, ['retry'], 'wifi-off', ['retry']],
    [
      'offline-copy-required',
      true,
      ['acquire-offline-copy'],
      'download-cloud',
      ['download'],
      false,
    ],
    ['offline-copy-required', false, ['acquire-offline-copy'], 'wifi-off', [], true],
    [
      'invalid-offline-copy',
      true,
      ['repair-offline-copy', 'manage-offline-copies'],
      'alert-triangle',
      ['repair', 'manage'],
      false,
    ],
    [
      'invalid-offline-copy',
      false,
      ['repair-offline-copy', 'manage-offline-copies'],
      'alert-triangle',
      ['repair', 'manage'],
      true,
    ],
    ['temporary-unavailable', true, ['retry'], 'cloud-off', ['retry'], false],
    ['temporary-unavailable', false, ['retry'], 'cloud-off', ['retry'], false],
    [
      'integrity-failure',
      true,
      ['retry', 'repair-offline-copy', 'manage-offline-copies'],
      'shield-off',
      ['retry', 'repair', 'manage'],
      false,
    ],
    [
      'integrity-failure',
      false,
      ['retry', 'repair-offline-copy', 'manage-offline-copies'],
      'shield-off',
      ['retry', 'repair', 'manage'],
      true,
    ],
    ['unsupported', true, ['acquire-offline-copy'], 'slash', ['download'], false],
    ['unsupported', false, ['acquire-offline-copy'], 'slash', [], true],
    ['unknown', true, ['retry'], 'alert-circle', ['retry'], false],
    ['unknown', false, ['retry'], 'alert-circle', ['retry'], false],
  ] as const)(
    'maps %s while online=%s to a stable presentation',
    (cause, isOnline, recoveries, icon, actions, connectionRequired = false) => {
      expect(
        getResourceFailurePresentation({ cause, recoveries: [...recoveries] }, { isOnline })
      ).toMatchObject({ icon, actions, connectionRequired })
    }
  )

  it('normalizes Resource access and Bible failures without collapsing domain absence', () => {
    expect(
      resourceFailureFromAccessError(new ResourceAccessError('NETWORK_OFFLINE', ['retry']))
    ).toEqual({ cause: 'network-offline', recoveries: ['retry'] })
    expect(resourceFailureFromBibleError({ type: 'CHAPTER_NOT_FOUND', recoveries: [] })).toEqual({
      cause: 'not-found',
      recoveries: [],
    })
  })

  it.each([
    ['CHAPTER_NOT_FOUND', true, 'search'],
    ['RESOURCE_OFFLINE', false, 'wifi-off'],
    ['RESOURCE_TEMPORARY_UNAVAILABLE', true, 'cloud-off'],
  ] as const)('gives Bible DOM %s the shared %s icon state', (type, isOnline, icon) => {
    expect(
      getResourceFailurePresentation(
        resourceFailureFromBibleError({ type, recoveries: ['retry'] }),
        { isOnline }
      ).icon
    ).toBe(icon)
  })

  it.each(['Nave', 'Dictionary'])('keeps %s network errors classified as offline', () => {
    expect(resourceFailureFromAccessError(new ResourceAccessError('NETWORK_OFFLINE')).cause).toBe(
      'network-offline'
    )
  })

  it('turns legacy invalid-copy acquisition into an explicit repair recovery', () => {
    expect(
      resourceFailureFromAccessError(
        new ResourceAccessError('INVALID_OFFLINE_COPY', [
          'acquire-offline-copy',
          'manage-offline-copies',
        ])
      )
    ).toEqual({
      cause: 'invalid-offline-copy',
      recoveries: ['repair-offline-copy', 'manage-offline-copies'],
    })
  })

  it('keeps invalid and integrity recovery actionable when producers omit recoveries', () => {
    expect(resourceFailureFromAccessError(new ResourceAccessError('INVALID_OFFLINE_COPY'))).toEqual(
      {
        cause: 'invalid-offline-copy',
        recoveries: ['repair-offline-copy', 'manage-offline-copies'],
      }
    )
    expect(resourceFailureFromAccessError(new ResourceAccessError('INTEGRITY_FAILURE'))).toEqual({
      cause: 'integrity-failure',
      recoveries: ['retry', 'repair-offline-copy', 'manage-offline-copies'],
    })
  })

  it('prevents Bible DOM download recovery while the device is offline', () => {
    expect(
      getResourceFailurePresentation(
        resourceFailureFromBibleError({
          type: 'BIBLE_NOT_FOUND',
          recoveries: ['acquire-offline-copy'],
        }),
        { isOnline: false }
      )
    ).toMatchObject({ icon: 'wifi-off', actions: [], connectionRequired: true })
  })

  it('normalizes availability corruption through the same repair seam', () => {
    expect(
      resourceFailureFromAvailability({
        reason: 'invalid-offline-copy',
        recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
      })
    ).toEqual({
      cause: 'invalid-offline-copy',
      recoveries: ['repair-offline-copy', 'manage-offline-copies'],
    })
  })

  it('keeps an offline repair visible and marks its connection dependency', () => {
    expect(
      getResourceFailurePresentation(
        { cause: 'invalid-offline-copy', recoveries: ['repair-offline-copy'] },
        { isOnline: false }
      )
    ).toMatchObject({ actions: ['repair'], connectionRequired: true })
  })

  it('normalizes Bible integrity recovery into retry, repair, and management', () => {
    expect(
      resourceFailureFromBibleError({
        type: 'RESOURCE_INTEGRITY_ERROR',
        recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
      })
    ).toEqual({
      cause: 'integrity-failure',
      recoveries: ['retry', 'repair-offline-copy', 'manage-offline-copies'],
    })
  })

  it.each([
    [
      { status: 'missing', moduleId: 'core' },
      { cause: 'offline-copy-required', recoveries: ['acquire-offline-copy'] },
    ],
    [
      { status: 'core-missing', moduleId: 'resources' },
      { cause: 'offline-copy-required', recoveries: ['acquire-offline-copy'] },
    ],
    [
      { status: 'incompatible', moduleId: 'core' },
      {
        cause: 'invalid-offline-copy',
        recoveries: ['repair-offline-copy', 'manage-offline-copies'],
      },
    ],
    [
      { status: 'corrupt', moduleId: 'core', reason: 'checksum mismatch' },
      {
        cause: 'integrity-failure',
        recoveries: ['retry', 'repair-offline-copy', 'manage-offline-copies'],
      },
    ],
  ] as const)('normalizes Strong module availability %#', (availability, expected) => {
    expect(resourceFailureFromStrongModuleAvailability(availability)).toEqual(expected)
  })
})
