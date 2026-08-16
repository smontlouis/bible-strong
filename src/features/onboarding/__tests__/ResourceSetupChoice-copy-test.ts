import english from '../../../../i18n/locales/en/translation.json'

describe('Initial Offline setup choice copy', () => {
  it('does not promise that the default KJV is remotely readable before publication', () => {
    expect(english['offlineSetup.choice.startNowDescription']).toBe(
      'Use Bible Strong without downloading. KJV and other resources can be added later.'
    )
  })
})
