jest.mock('react-native-url-polyfill/auto', () => ({}))
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
}))
jest.mock('~helpers/runtimeConfig', () => ({ isPlaygroundEnabled: false }))
jest.mock('~helpers/storage', () => ({
  storage: { getString: jest.fn(), set: jest.fn() },
}))

const initializeLanguage = async (locale: string, cachedLanguage?: string) => {
  jest.resetModules()
  const originalOptions = new Intl.DateTimeFormat().resolvedOptions()
  jest
    .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
    .mockReturnValue({ ...originalOptions, locale })
  const { storage } = await import('~helpers/storage')
  jest.mocked(storage.getString).mockReturnValue(cachedLanguage)
  const { default: i18n, setI18n, getLanguage } = await import('../index')
  await setI18n()
  return { i18n, getLanguage, storage }
}

afterEach(() => jest.restoreAllMocks())

it.each([
  ['fr-FR', 'fr'],
  ['fr-CA', 'fr'],
  ['en-US', 'en'],
  ['en-GB', 'en'],
  ['de-CH', 'en'],
  ['es-ES', 'en'],
  ['pt-BR', 'en'],
  ['ar-EG', 'en'],
])('starts in %s with the expected app language %s', async (locale, expected) => {
  const { i18n, getLanguage, storage } = await initializeLanguage(locale)
  expect(i18n.language).toBe(expected)
  expect(getLanguage()).toBe(expected)
  expect(i18n.t('settings.settings')).toBe(expected === 'fr' ? 'Paramètres' : 'Settings')
  expect(storage.set).toHaveBeenCalledWith('lang', expected)
})

it.each([
  ['de-CH', 'fr'],
  ['fr-FR', 'en'],
])('preserves saved %s / %s preferences', async (locale, saved) => {
  const { i18n, getLanguage } = await initializeLanguage(locale, saved)
  expect(i18n.language).toBe(saved)
  expect(getLanguage()).toBe(saved)
})

it('ignores an unsupported cached language', async () => {
  const { i18n, getLanguage } = await initializeLanguage('de-CH', 'de')
  expect(i18n.t('settings.settings')).toBe('Settings')
  expect(getLanguage()).toBe('en')
})

it('falls back to English when a translation is unavailable in French', async () => {
  const { i18n } = await initializeLanguage('fr-FR')
  i18n.addResource('en', 'translation', 'english-only-test', 'English fallback')
  expect(i18n.t('english-only-test')).toBe('English fallback')
})
