import {
  dismissStrongLexiconModulePrompt,
  strongLexiconModulePromptPreferencesAtom,
} from '../strongLexiconModulePrompts'

jest.mock('~helpers/atomWithAsyncStorage', () => ({
  __esModule: true,
  default: jest.fn((key, initialValue) => ({ key, initialValue })),
}))

const mockAtomWithAsyncStorage = jest.requireMock('../../helpers/atomWithAsyncStorage').default

describe('strongLexiconModulePrompts', () => {
  it('persists the dismissed module prompts in device storage', () => {
    expect(mockAtomWithAsyncStorage).toHaveBeenCalledWith(
      'strongLexiconModulePromptPreferences',
      {}
    )
    expect(strongLexiconModulePromptPreferencesAtom).toEqual({
      key: 'strongLexiconModulePromptPreferences',
      initialValue: {},
    })
  })

  it('dismisses each optional module independently', () => {
    const resourcesDismissed = dismissStrongLexiconModulePrompt({}, 'resources')

    expect(resourcesDismissed).toEqual({ resources: true })
    expect(dismissStrongLexiconModulePrompt(resourcesDismissed, 'entities')).toEqual({
      resources: true,
      entities: true,
    })
  })

  it('keeps the same state when a module is already dismissed', () => {
    const preferences = { entities: true }

    expect(dismissStrongLexiconModulePrompt(preferences, 'entities')).toBe(preferences)
  })
})
