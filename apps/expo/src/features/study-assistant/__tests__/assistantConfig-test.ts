import type { AssistantOpening } from '~helpers/assistantOpening'

const opening = (open: boolean, betaUids: string[] = []): AssistantOpening => ({
  open,
  betaUids: new Set(betaUids),
})

// `assistantAvailable` is read once, from the build's environment.
const load = () => {
  process.env.EXPO_PUBLIC_AI_API_URL = 'https://assistant.example'
  let module!: typeof import('../assistantConfig')
  jest.isolateModules(() => {
    module = require('../assistantConfig')
  })
  return module
}

it('shows Strobi to a visitor once it is open to everyone, not during the beta', () => {
  const { assistantAccessible } = load()
  expect(assistantAccessible(opening(true), null)).toBe(true)
  expect(assistantAccessible(opening(false, ['a'.repeat(28)]), null)).toBe(false)
})

it('shows it to an account open to everyone or on the beta list', () => {
  const { assistantAccessible } = load()
  const tester = 'b'.repeat(28)
  expect(assistantAccessible(opening(true), tester)).toBe(true)
  expect(assistantAccessible(opening(false, [tester]), tester)).toBe(true)
  expect(assistantAccessible(opening(false), tester)).toBe(false)
})
