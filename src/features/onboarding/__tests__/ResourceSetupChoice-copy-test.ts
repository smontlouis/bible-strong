import english from '../../../../i18n/locales/en/translation.json'

describe('Initial Offline setup choice copy', () => {
  it('describes the online start without naming a default translation', () => {
    expect(english['offlineSetup.choice.startNowDescription']).toBe(
      'Start right away'
    )
  })
})
