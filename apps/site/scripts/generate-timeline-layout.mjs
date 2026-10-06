// Rebuilds features/timeline/timelineLayout.json from the timeline bundled with the study
// workspace. The Timeline publication carries no placement; the workspace does.
//
//   node apps/site/scripts/generate-timeline-layout.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const site = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(site, '../expo/src/assets/timeline/events.txt')
const target = join(site, 'features/timeline/timelineLayout.json')

const MAJOR = 1
const FIXED_WIDTH = 2

const sections = JSON.parse(readFileSync(source, 'utf8'))
const events = {}
for (const section of sections) {
  for (const event of section.events) {
    // An event crossing two periods is listed in both, at the same place.
    if (events[event.slug]) continue
    const flags = (event.type === 'major' ? MAJOR : 0) | (event.isFixed ? FIXED_WIDTH : 0)
    events[event.slug] = [event.start, event.end, flags]
  }
}

const lines = Object.entries(events).map(
  ([slug, placement]) => `  ${JSON.stringify(slug)}: ${JSON.stringify(placement)}`
)
writeFileSync(target, `{\n${lines.join(',\n')}\n}\n`)
console.log(`${lines.length} events written to ${target}`)
