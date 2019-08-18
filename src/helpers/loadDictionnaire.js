import SQLTransaction from '~helpers/SQLTransaction'

const loadDictionnaire = async () => {
  const result = await SQLTransaction(
    `SELECT word, sanitized_word
    FROM dictionnaire 
    ORDER BY sanitized_word ASC
    `
  )

  return result
}

export default loadDictionnaire
