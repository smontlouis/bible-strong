import React, { Fragment } from 'react'
import BibleStrongReference from '~features/bible/BibleStrongReference'
import Paragraph from '~common/ui/Paragraph'

const verseToStrong = ({ Texte, Livre }, concordanceFor, isSmall) =>
  new Promise(resolve => {
    let formattedTexte
    const references = []

    // STRONG -- We don't want what is in parentheses
    const splittedTexte = Texte.split(/\s*(\(?\d+[^{.|\s}]?\d+(?!\.?\d)\)?)/g)

    formattedTexte = splittedTexte.map((item, i) => {
      // For every number, replace it with last word of previous item
      if (Number.isInteger(Number(item)) && item) {
        references.push(item)
        const prevItem = splittedTexte[i - 1].split(' ')
        return (
          <Fragment key={i}>
            {(i - 1 !== 0 || prevItem.length > 1) && <Paragraph small={isSmall}>&nbsp;</Paragraph>}
            <BibleStrongReference
              small={isSmall}
              concordanceFor={concordanceFor}
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
        return (
          <Paragraph small={isSmall} key={i}>
            {item}
          </Paragraph>
        )
      }

      const words = item.split(' ').slice(0, -1)
      // Delete last word
      return (
        <Fragment key={i}>
          {words.map((w, j) => (
            <Paragraph small={isSmall} key={j}>
              {w}
              {!(j === words.length - 1) && ' '}
            </Paragraph>
          ))}
        </Fragment>
      )
    })
    return resolve({ formattedTexte, references })
  })

export default verseToStrong
