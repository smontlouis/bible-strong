import SQLTransaction from '@helpers/SQLTransaction'

const loadStrongVerse = async ({ Livre, Chapitre, Verset }) => {
  const part = Livre > 39 ? 'LSGSNT2' : 'LSGSAT2'
  const result = await SQLTransaction(
    `SELECT Texte 
            FROM ${part}
            WHERE LIVRE = ${Livre}
            AND CHAPITRE  = ${Chapitre}
            AND VERSET = ${Verset}`
  )
  return result[0]
}

export default loadStrongVerse
