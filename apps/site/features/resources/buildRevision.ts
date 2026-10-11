// What the build is made of, written here by the build itself (`bundling/buildRevision.ts`).
// The development server has none: nothing is kept there.
const BUILT = '__SITE_BUILD_REVISION__'

export const BUILD_REVISION: string | undefined = BUILT.startsWith('__') ? undefined : BUILT
