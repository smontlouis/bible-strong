import { access } from 'node:fs/promises'
import { validateTimelineResourcePublication } from '../src/packageTimelineResourcePublication.js'

for (const [language, value] of Object.entries({
  fr: process.env.TIMELINE_FR_BUNDLE,
  en: process.env.TIMELINE_EN_BUNDLE,
})) {
  if (!value) throw new Error(`timeline-smoke-bundle-missing:${language}`)
  await access(value)
  const manifest = await validateTimelineResourcePublication(value)
  if (manifest.identity.language !== language) throw new Error(`timeline-smoke-language:${language}`)
  console.log(JSON.stringify({ language, revision: manifest.revision, counts: manifest.counts }))
}
console.log('timeline-publications-smoke:ok')
