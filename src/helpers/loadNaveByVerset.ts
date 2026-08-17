import { getSQLTransactionForLang } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError.new'
import * as Sentry from '@sentry/react-native'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getResourceLanguage } from '~state/resourcesLanguage'

type NaveRefRow = {
  id: string
  ref: string
}

type NaveTopicsQuery = {
  name: string
  name_lower: string
}[]

const loadNaveByVerset = (
  verse: string,
  language: ResourceLanguage = getResourceLanguage('NAVE')
) =>
  catchDatabaseError(
    async () => {
      const chapter = verse.split('-').slice(0, -1).join('-') // 1-1-1 => 1-1
      const transaction = getSQLTransactionForLang('NAVE', language)
      const referenceRows = await transaction<NaveRefRow>(
        'SELECT id, ref FROM VERSES WHERE id IN (?, ?)',
        [verse, chapter]
      )
      const referencesById = new Map(
        referenceRows.map(row => [row.id, new Set<string>(JSON.parse(row.ref))])
      )
      const references = [
        ...new Set(referenceRows.flatMap(row => [...referencesById.get(row.id)!])),
      ]
      if (!references.length) return [undefined, undefined]

      const topics = await transaction<NaveTopicsQuery[number]>(
        `SELECT name_lower, name FROM TOPICS
          WHERE name_lower IN (${references.map(() => '?').join(', ')})
          ORDER BY name`,
        references
      )
      const topicsFor = (id: string) => {
        const refs = referencesById.get(id)
        return refs ? topics.filter(topic => refs.has(topic.name_lower)) : undefined
      }

      return [topicsFor(verse), topicsFor(chapter)] as [
        NaveTopicsQuery | undefined,
        NaveTopicsQuery | undefined,
      ]
    },
    () => {
      Sentry.withScope(scope => {
        scope.setExtra('verse', verse)
        Sentry.captureMessage('Nave issue')
      })
    }
  )

export default loadNaveByVerset
