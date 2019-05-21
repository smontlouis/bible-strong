import SQLTransaction from '~helpers/SQLTransaction'

const updateReferencesOrder = (result, references) => {
  let updatedResult = []
  references = [...new Set(references)] // deleting duplicate references
  references.map((ref, index) => {
    let refCode = parseInt(ref)
    result.map((res, index) => {
      if (refCode === res.Code) updatedResult.push(res)
      else return false
    })
  })
  if (updatedResult.length !== result.length) return references
  else return updatedResult
}

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
  return updateReferencesOrder(result, references)
}

export default loadStrongReferences
