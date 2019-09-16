import SQLDTransaction from '~helpers/SQLDTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const capitalize = string => string.charAt(0).toUpperCase() + string.slice(1)

const loadDictionnaireItem = async word =>
  catchDatabaseError(async () => {
    const result = await SQLDTransaction(
      `SELECT word, definition FROM dictionnaire WHERE word = "${capitalize(
        word
      )}" OR sanitized_word = "${word}"`
    )
    return result[0]
  })

export default loadDictionnaireItem
