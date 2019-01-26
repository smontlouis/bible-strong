import SQLTransaction from '@helpers/SQLTransaction'

const loadStrongReferences = async (references, book) => {
  const part = book > 39 ? 'Grec' : 'Hebreu'
  const sqlReq = references.reduce((sqlString, reference, index) => {
    sqlString += `Code = ${reference} `
    if (references.length - 1 !== index) {
      sqlString += 'OR '
    }
    return sqlString
  }, `SELECT * FROM ${part} WHERE `)

  const result = await SQLTransaction(sqlReq)
  return result
}

export default loadStrongReferences
