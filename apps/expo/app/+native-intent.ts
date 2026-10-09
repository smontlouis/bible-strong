import { resolveSystemPath } from '~navigation/systemLinks'

// Links handed over by the system: a page of the public site opens on its screen (ADR-0082).
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return resolveSystemPath(path)
  } catch {
    return path
  }
}
