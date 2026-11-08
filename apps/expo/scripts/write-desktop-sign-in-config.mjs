// Writes the public Firebase settings the desktop sign-in page reads (ADR-0107), from the
// EXPO_PUBLIC_* values of the build, into <outDir>/desktop-sign-in/config.json.
//
//   node scripts/write-desktop-sign-in-config.mjs dist
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const outDir = process.argv[2]
if (!outDir) throw new Error('Usage: write-desktop-sign-in-config.mjs <outDir>')

const required = (name, value) => {
  if (!value) throw new Error(`${name} is required for the desktop sign-in page`)
  return value
}

const projectId = required(
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
)
const config = {
  apiKey: required('EXPO_PUBLIC_FIREBASE_API_KEY', process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain: required(
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
  ),
  projectId,
  appId: required('EXPO_PUBLIC_FIREBASE_APP_ID', process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
  desktopSignInTokenUrl: `https://us-central1-${projectId}.cloudfunctions.net/createDesktopSignInToken`,
}

const directory = join(outDir, 'desktop-sign-in')
mkdirSync(directory, { recursive: true })
writeFileSync(join(directory, 'config.json'), `${JSON.stringify(config, null, 2)}\n`)
console.log(`[desktop-sign-in] config written to ${directory}`)
