import SQLDTransaction from '~helpers/SQLDTransaction'

const loadDictionnaireItem = async word => {
  const result = await SQLDTransaction(`SELECT definition FROM dictionnaire WHERE word = "${word}"`)
  return result[0]
}

export default loadDictionnaireItem
