// Writes docs/valence-1876/dialogues.md from src/valence/valence-story.ts (the source of truth).
// Usage, from apps/world: node --experimental-strip-types scripts/valence/export-dialogues.mjs
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const { stations, speakers, pioneerObjects } = await import(resolve(root, 'src/valence/valence-story.ts'))
const kind = { real: 'personne réelle, dialogue reconstitué', composite: 'personnage composite', narrator: 'note' }
const beats = { fact: 'Le fait', study: 'Comment j’étudie', today: 'Aujourd’hui' }
const out = [
  '# Valence 1876 : les dialogues',
  '',
  'Fichier généré depuis `src/valence/valence-story.ts`, qui fait foi (`node --experimental-strip-types scripts/valence/export-dialogues.mjs`). Les versions anglaises sont dans le même fichier.',
  '',
]
for (const station of stations) {
  out.push(`## ${station.order}. ${station.place.fr}, ${station.date.fr} : ${station.title.fr}`, '')
  for (const beat of ['fact', 'study']) {
    if (!station[beat].length) continue
    out.push(`### ${station.id === 'rhone' && beat === 'study' ? 'Épilogue' : beats[beat]}`, '')
    for (const line of station[beat]) {
      const speaker = speakers[line.speaker]
      if (speaker.kind === 'narrator') out.push('', `> ${line.text.fr}`, '')
      else out.push(`- **${speaker.name.fr}** (${kind[speaker.kind]}) : ${line.text.fr}`)
    }
    out.push('')
  }
  if (station.today) {
    out.push(`### ${beats.today}`, '', `**${station.today.title.fr}.** ${station.today.body.fr}`)
    if (station.today.verse) out.push('', `> ${station.today.verse.text.fr} (${station.today.verse.reference.fr}, LSG)`)
    out.push('', `Lien : ${station.today.url.fr}`, '')
  }
  out.push('Sources :', '', ...station.sources.map(s => (s.url ? `- [${s.label}](${s.url})` : `- ${s.label}`)), '')
}
out.push('## Les sept objets du pionnier', '', '| Objet | Hier | Aujourd’hui | Lien |', '| --- | --- | --- | --- |')
for (const object of pioneerObjects)
  out.push(`| ${object.name.fr} | ${object.yesterday.fr} | ${object.today.fr} | ${object.url.fr} |`)
out.push('')
await writeFile(resolve(root, 'docs/valence-1876/dialogues.md'), out.join('\n'))
console.log('docs/valence-1876/dialogues.md')
