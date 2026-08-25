export function timeout(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}
