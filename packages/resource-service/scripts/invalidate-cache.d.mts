export type InvalidateCacheOptions = {
  api: string[]
  site: string[]
  siteEverything: boolean
  dryRun: boolean
}

export const readArguments: (argv: readonly string[]) => InvalidateCacheOptions | undefined
export const unknownIdentities: (
  identities: readonly string[],
  catalog: { resources: Record<string, unknown> }
) => string[]
export const withInvalidations: (
  invalidations: Readonly<Record<string, number>>,
  identities: readonly string[]
) => Record<string, number>
export const refreshArguments: (options: InvalidateCacheOptions) => string[]
