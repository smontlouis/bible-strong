import notifee from '@notifee/react-native'
import { Linking, Platform } from 'react-native'
import {
  openReadingNotificationSettings,
  readReadingPermission,
} from '../readingReminderDriver.native'

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Linking: { openSettings: jest.fn(async () => {}) },
}))
jest.mock('~helpers/firebaseAuthRuntime', () => ({ getCurrentAuthUser: () => null }))
jest.mock('../../../../i18n', () => ({ getLanguage: () => 'fr' }))
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
  AndroidImportance: { DEFAULT: 3 },
  TriggerType: { TIMESTAMP: 0 },
  default: {
    getNotificationSettings: jest.fn(async () => ({ authorizationStatus: 1 })),
    isChannelCreated: jest.fn(async () => false),
    isChannelBlocked: jest.fn(async () => false),
    openNotificationSettings: jest.fn(async () => {}),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
  Object.assign(Platform, { OS: 'ios' })
})

describe('native reading-notification permission adapter', () => {
  it('uses iOS Settings rather than Notifee’s Android-only settings API', async () => {
    await openReadingNotificationSettings()
    expect(Linking.openSettings).toHaveBeenCalledTimes(1)
    expect(notifee.openNotificationSettings).not.toHaveBeenCalled()
  })
  it('opens the specific channel settings on Android', async () => {
    Object.assign(Platform, { OS: 'android' })
    jest.mocked(notifee.isChannelCreated).mockResolvedValueOnce(true)
    await openReadingNotificationSettings()
    expect(notifee.openNotificationSettings).toHaveBeenCalledWith('daily-reading')
    expect(Linking.openSettings).not.toHaveBeenCalled()
  })
  it('opens app settings before the first Android channel has been created', async () => {
    Object.assign(Platform, { OS: 'android' })
    await openReadingNotificationSettings()
    expect(notifee.openNotificationSettings).toHaveBeenCalledWith()
  })
  it('opens app settings for app-wide denial even if the channel exists', async () => {
    Object.assign(Platform, { OS: 'android' })
    jest.mocked(notifee.getNotificationSettings).mockResolvedValueOnce({
      ...(await notifee.getNotificationSettings()),
      authorizationStatus: 0,
    })
    await openReadingNotificationSettings()
    expect(notifee.openNotificationSettings).toHaveBeenCalledWith()
    expect(notifee.isChannelCreated).not.toHaveBeenCalled()
  })
  it('allows a first Android schedule before its channel exists', async () => {
    Object.assign(Platform, { OS: 'android' })
    expect(await readReadingPermission()).toBe('allowed')
    expect(notifee.isChannelBlocked).not.toHaveBeenCalled()
  })
  it('recognizes a blocked Android channel even when app-wide permission is allowed', async () => {
    Object.assign(Platform, { OS: 'android' })
    jest.mocked(notifee.isChannelCreated).mockResolvedValueOnce(true)
    jest.mocked(notifee.isChannelBlocked).mockResolvedValueOnce(true)
    expect(await readReadingPermission()).toBe('denied')
  })
})
