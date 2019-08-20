import SQLTransaction from '~helpers/SQLTransaction'
import SnackBar from '~common/SnackBar'

const updateReferencesOrder = (result, references) => {
  const updatedResult = []
  references = [...new Set(references)] // deleting duplicate references
  references.map((ref, index) => {
    const refCode = parseInt(ref)
    result.map((res, index) => {
      if (refCode === res.Code) updatedResult.push(res)
      else return false
    })
  })
  if (updatedResult.length !== result.length) return references
  return updatedResult
}

const loadStrongReferences = async (references, book) => {
  try {
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
  } catch (e) {
    SnackBar.show(
      "Base de données corrompue. Veuillez contacter le développeur ou réinstaller l'application",
      'danger'
    )
  }
}

export default loadStrongReferences
