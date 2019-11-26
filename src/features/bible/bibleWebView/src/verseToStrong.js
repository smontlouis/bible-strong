import React, { useContext } from 'react'
import styled from '@emotion/styled'
import VerseContext from './VerseContext'
import { dispatch, NAVIGATE_TO_STRONG } from './dispatch'

const StyledReference = styled('div')(({ isSelected, settings: { theme, colors } }) => ({
  display: 'inline-block',
  transition: 'background 0.3s ease',
  borderRadius: 4,
  padding: '0 5px',
  background: colors[theme].lightPrimary,

  ...(isSelected
    ? {
        background: colors[theme].primary,
        color: 'white'
      }
    : {})
}))

const BibleStrongRef = ({ book, reference }) => {
  const { selectedCode, settings } = useContext(VerseContext)
  const isSelected = selectedCode && selectedCode.reference == reference

  const navigateToStrong = () => {
    dispatch({
      type: NAVIGATE_TO_STRONG,
      payload: { reference, book }
    })
  }

  return (
    <StyledReference onClick={navigateToStrong} isSelected={isSelected} settings={settings}>
      {reference}
    </StyledReference>
  )
}

const verseToStrong = ({ Texte, Livre }) =>
  new Promise(resolve => {
    // STRONG
    const splittedTexte = Texte.split(/(\d+[^{.|\s}]?\d+(?!\.?\d))/g).map((item, i) => {
      if (Number.isInteger(Number(item))) {
        return <BibleStrongRef book={Livre} reference={item} key={i} />
      }

      return item
    })
    return resolve(splittedTexte)
  })

export default verseToStrong
