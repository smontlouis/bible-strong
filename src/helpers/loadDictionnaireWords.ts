import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError.new'
import * as Sentry from '@sentry/react-native'

type DictionaryRefQuery = {
  ref: string
}[]

const loadDictionnaireWords = async (v: string) =>
  catchDatabaseError(
    async () => {
      const result: DictionaryRefQuery = await SQLDictionnaireTransaction(
        `SELECT ref
      FROM verses
      WHERE id LIKE (?)
      `,
        [v]
      )
      return (JSON.parse(result[0].ref) as string[]).map(word =>
        word.toLowerCase()
      )
    },
    () => {
      Sentry.withScope(scope => {
        scope.setExtra('verse', v)
        Sentry.captureMessage('Nave issue')
      })
    }
  )

export default loadDictionnaireWords
