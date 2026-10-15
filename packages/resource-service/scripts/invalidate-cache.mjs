#!/usr/bin/env node
// Empties by hand the parts of the caches that changed. Nothing else empties them: deploying the
// Resource API or the site keeps both (ADR-0076 and ADR-0084, amended).
//
//   yarn cache:invalidate --api bible:LSG cross-references:fr   then deploy the Resource API
//   yarn cache:invalidate --site /bible/lsg /strong/fr           pages rendered again at once
//   yarn cache:invalidate --site-everything
//
// Add --dry-run to print what would be done. An API identity is a catalog identity
// (`bible:LSG`, `database:MHY:fr`) or `cross-references:<language>`. A site folder is up to three
// levels deep (`/bible`, `/bible/lsg`, `/bible/lsg/gen`).
import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const INVALIDATIONS_FILE = new URL('../src/runtime/resourceApiInvalidations.json', import.meta.url)
const CATALOG_FILE = new URL(
  '../../resource-catalog/src/mobile-resource-catalog.json',
  import.meta.url
)
const REFRESH_PAGES = fileURLToPath(
  new URL('../../../apps/site/scripts/refresh-pages.mjs', import.meta.url)
)
// Published content the Artifact catalog does not describe (see `resourceApiCache.ts`).
const UNCATALOGUED_IDENTITY = /^cross-references:(?:fr|en)$/u

const USAGE = `Usage: invalidate-cache.mjs [--api <identity>...] [--site <folder>... | --site-everything] [--dry-run]

  --api <identity>    counts one more invalidation of a resource in the Resource API cache;
                      takes effect with the next deployment of the Resource API
  --site <folder>     renders again the public pages under a folder, at once
  --site-everything   renders again every public page, at once
  --dry-run           prints what would be done, and does nothing
`

export const readArguments = argv => {
  const options = { api: [], site: [], siteEverything: false, dryRun: false }
  let list
  for (const argument of argv) {
    if (argument === '--api') list = options.api
    else if (argument === '--site') list = options.site
    else if (argument === '--site-everything') {
      options.siteEverything = true
      list = undefined
    } else if (argument === '--dry-run') options.dryRun = true
    else if (argument.startsWith('--') || !list) return undefined
    else list.push(argument)
  }
  const nothing = !options.api.length && !options.site.length && !options.siteEverything
  if (nothing || (options.siteEverything && options.site.length)) return undefined
  return options
}

/** The identities neither the catalog nor the uncatalogued content name. */
export const unknownIdentities = (identities, catalog) =>
  identities.filter(
    identity => !(identity in catalog.resources) && !UNCATALOGUED_IDENTITY.test(identity)
  )

/** One more invalidation for each identity, the list kept sorted for a readable diff. */
export const withInvalidations = (invalidations, identities) => {
  const next = { ...invalidations }
  for (const identity of new Set(identities)) next[identity] = (next[identity] ?? 0) + 1
  return Object.fromEntries(
    Object.entries(next).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  )
}

/** The arguments of `refresh-pages.mjs` for the folders asked. */
export const refreshArguments = options =>
  options.siteEverything ? ['--everything'] : [...options.site]

const readJson = async file => JSON.parse(await readFile(file, 'utf8'))

const invalidateApi = async options => {
  const catalog = await readJson(CATALOG_FILE)
  const unknown = unknownIdentities(options.api, catalog)
  if (unknown.length > 0) {
    process.stderr.write(`Unknown identities, nothing was changed: ${unknown.join(', ')}\n`)
    return false
  }
  const next = withInvalidations(await readJson(INVALIDATIONS_FILE), options.api)
  if (options.dryRun) {
    process.stdout.write(
      `Would write resourceApiInvalidations.json:\n${JSON.stringify(next, null, 2)}\n`
    )
    return true
  }
  await writeFile(INVALIDATIONS_FILE, `${JSON.stringify(next, null, 2)}\n`)
  process.stdout.write(
    `Invalidated in the Resource API cache: ${options.api.join(', ')}.\n` +
      'Commit packages/resource-service/src/runtime/resourceApiInvalidations.json, merge, and\n' +
      'deploy the Resource API from master (yarn resources:worker:deploy).\n'
  )
  return true
}

const refreshSite = options => {
  const args = refreshArguments(options)
  if (options.dryRun) {
    process.stdout.write(`Would run: node apps/site/scripts/refresh-pages.mjs ${args.join(' ')}\n`)
    return true
  }
  return spawnSync(process.execPath, [REFRESH_PAGES, ...args], { stdio: 'inherit' }).status === 0
}

const main = async () => {
  const options = readArguments(process.argv.slice(2))
  if (!options) {
    process.stderr.write(USAGE)
    process.exitCode = 2
    return
  }
  const wantsSite = options.siteEverything || options.site.length > 0
  if (options.api.length > 0) {
    if (!(await invalidateApi(options))) {
      process.exitCode = 1
      return
    }
    // Pages rendered now would read the answers the API still keeps until it is deployed.
    if (wantsSite) {
      process.stdout.write(
        `Once the Resource API is deployed: yarn cache:invalidate ${
          options.siteEverything ? '--site-everything' : `--site ${options.site.join(' ')}`
        }\n`
      )
    }
    return
  }
  if (!refreshSite(options)) process.exitCode = 1
}

// No top-level await: the tests load this file from a CommonJS package.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) void main()
