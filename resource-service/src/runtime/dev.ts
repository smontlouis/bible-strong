import { spawnSync } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import path from 'node:path'

import { getDevelopmentEndpoints, RESOURCE_DEVELOPMENT_COMMANDS } from './development'

const run = ([command, ...args]: readonly string[]) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`RESOURCE_DEVELOPMENT_COMMAND_FAILED:${command}`)
  }
}

const getLanAddress = (): string | undefined => {
  for (const addresses of Object.values(networkInterfaces())) {
    const address = addresses?.find(candidate => candidate.family === 'IPv4' && !candidate.internal)
    if (address) return address.address
  }
  return undefined
}

for (const command of RESOURCE_DEVELOPMENT_COMMANDS) run(command)
const publicationRoots = process.env.RESOURCE_PUBLICATION_ROOTS?.split(path.delimiter)
  .map(root => root.trim())
  .filter(Boolean)

if (publicationRoots?.length) {
  run(['yarn', 'resources:import-catalog', ...publicationRoots.flatMap(root => ['--root', root])])
} else if (process.env.RESOURCE_PUBLICATION_BUNDLE) {
  run(['yarn', 'resources:import', '--bundle', process.env.RESOURCE_PUBLICATION_BUNDLE])
} else if (process.env.RESOURCE_PUBLICATION_BUNDLES_ROOT) {
  run(['yarn', 'resources:import-all', '--root', process.env.RESOURCE_PUBLICATION_BUNDLES_ROOT])
}

const port = Number(process.env.RESOURCE_API_PORT ?? 8787)
const endpoints = getDevelopmentEndpoints({ port, lanAddress: getLanAddress() })

console.log('Resource service development endpoints:')
console.log(`  Host: ${endpoints.host}`)
console.log(`  iOS Simulator: ${endpoints.iosSimulator}`)
console.log(`  Android Emulator: ${endpoints.androidEmulator}`)
console.log(`  Physical device: ${endpoints.physicalDevice}`)

void import('./node').catch(error => {
  console.error(error)
  process.exitCode = 1
})
