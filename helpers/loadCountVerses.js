import SQLTransaction from '@helpers/SQLTransaction'

const loadCountVerses = async ({ Livre, Chapitre, Verset }) => {
  const part = Livre > 39 ? 'LSGSNT2' : 'LSGSAT2'
  const result = await SQLTransaction(
    `SELECT count(*)  as versesInCurrentChapter
            FROM ${part}
            WHERE LIVRE = ${Livre}
            AND CHAPITRE  = ${Chapitre}`
  )
  return result[0]
}

export default loadCountVerses
