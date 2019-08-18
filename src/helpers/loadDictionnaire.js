import SQLDTransaction from '~helpers/SQLDTransaction'

const loadDictionnaire = async () => {
  const result = await SQLDTransaction(
    `SELECT rowid, word, sanitized_word
    FROM dictionnaire 
    ORDER BY sanitized_word ASC
    `
  )

  return result
}

export default loadDictionnaire
