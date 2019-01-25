import React, { Fragment } from 'react'
import BibleStrongReference from '@components/BibleStrongReference'
import Text from '@ui/Text'

const verseToStrong = ({ Texte, Livre }, concordanceFor) =>
  new Promise(resolve => {
    let formattedTexte

    // Hide codes when concordance
    if (concordanceFor) {
      const concordanceForToString = concordanceFor.toString()
      formattedTexte = Texte.split(/ (\(?\d+[^{.|\s}]?\d+(?!\.?\d)\)?)/g).map(
        (item, i) => {
          if (
            item.match(/\d+/) &&
            (item.match(/\d+/)[0] === concordanceFor ||
              item.match(/\d+/)[0] === `0${concordanceForToString}`)
          ) {
            return (
              <BibleStrongReference
                isFromConcordance
                book={Livre}
                reference={item.match(/\d+/)[0]}
                key={i}
              />
            )
          }

          if (item.match(/\d+/) && !item.includes('.')) {
            return null
          }
          return item
        }
      )
      return resolve(formattedTexte)
    }

    // STRONG -- We don't want what is in parentheses
    const splittedTexte = Texte.split(/\s*(\(?\d+[^{.|\s}]?\d+(?!\.?\d)\)?)/g)
    // console.log(splittedTexte)
    formattedTexte = splittedTexte.map((item, i) => {
      // For every number, replace it with last word of previous item
      if (Number.isInteger(Number(item)) && item) {
        const prevItem = splittedTexte[i - 1].split(' ')
        return (
          <Fragment key={i}>
            {(i - 1 !== 0 || prevItem.length > 1) && <Text>&nbsp;</Text>}
            <BibleStrongReference
              book={Livre}
              word={prevItem[prevItem.length - 1]}
              reference={item}
            />
          </Fragment>
        )
      }

      // Remove number with parentheses
      if (item.match(/\(\d+\)/)) {
        return null
      }

      // Don't delete last word if last item
      if (i === splittedTexte.length - 1) {
        return <Text key={i}>{item}</Text>
      }

      const words = item.split(' ').slice(0, -1)
      // Delete last word
      return (
        <Fragment key={i}>
          {words.map((w, j) => (
            <Text key={j}>
              {w}
              {!(j === words.length - 1) && ' '}
            </Text>
          ))}
        </Fragment>
      )
    })
    return resolve(formattedTexte)
  })

export default verseToStrong
