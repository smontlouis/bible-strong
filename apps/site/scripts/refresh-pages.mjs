#!/usr/bin/env node
// Asks the site to render again pages Cloudflare keeps (ADR-0084). A page is kept a month:
// after a resource is republished, or after the Resource API is deployed, its pages are
// rendered again on their next request rather than at the end of that month.
//
//   node apps/site/scripts/refresh-pages.mjs --everything
//   node apps/site/scripts/refresh-pages.mjs /bible/lsg /commentary/fr/mhy-fr
//
// The secret is read from CACHE_REFRESH_SECRET, or from `apps/site/.env.local`.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const USAGE = `Usage: refresh-pages.mjs (--everything | <folder>...) [--site <origin>]

  --everything     every kept page
  <folder>         the pages under a folder of the site, up to three levels deep:
                   /bible, /bible/lsg, /bible/lsg/gen
  --site <origin>  the site to ask (default: https://bible-strong.app)
`

export const readArguments = argv => {
  const options = { site: 'https://bible-strong.app', everything: false, paths: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--everything') options.everything = true
    else if (argument === '--site') options.site = argv[(index += 1)]
    else if (argument.startsWith('--')) return undefined
    else options.paths.push(argument)
  }
  if (!options.site || options.everything === options.paths.length > 0) return undefined
  if (options.paths.some(path => !path.startsWith('/') || path.split('/').filter(Boolean).length > 3)) {
    return undefined
  }
  return options
}

const secretFromFile = async () => {
  const file = fileURLToPath(new URL('../.env.local', import.meta.url))
  const text = await readFile(file, 'utf8').catch(() => '')
  const value = /^CACHE_REFRESH_SECRET=(.*)$/mu.exec(text)?.[1]?.trim()
  return value?.replace(/^(["'])(.*)\1$/u, '$2')
}

const main = async () => {
  const options = readArguments(process.argv.slice(2))
  if (!options) {
    process.stderr.write(USAGE)
    process.exitCode = 2
    return
  }
  const secret = process.env.CACHE_REFRESH_SECRET || (await secretFromFile())
  if (!secret) {
    process.stderr.write('CACHE_REFRESH_SECRET is not set, here or in apps/site/.env.local.\n')
    process.exitCode = 1
    return
  }
  const response = await fetch(new URL('/__cache/refresh', options.site), {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify(options.everything ? { everything: true } : { paths: options.paths }),
  })
  if (!response.ok) {
    process.stderr.write(`The site answered ${response.status}: no page was asked again.\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write(
    options.everything
      ? `Every page of ${options.site} is rendered again on its next request.\n`
      : `The pages under ${options.paths.join(', ')} are rendered again on their next request.\n`
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
