// What the tests are given in place of `cloudflare:workers`, which only exists inside a
// Worker: no binding, so the code under test takes the paths it takes in development.
export const env: Record<string, unknown> = {}
export const waitUntil = (_task: Promise<unknown>): void => undefined
