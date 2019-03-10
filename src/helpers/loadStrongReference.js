import SQLTransaction from '~helpers/SQLTransaction'

const loadStrongReference = async (reference, book) => {
  const part = book > 39 ? 'Grec' : 'Hebreu'
  const result = await SQLTransaction(
    `SELECT * FROM ${part} WHERE Code = ${reference}`
  )
  return result
}

export default loadStrongReference
