import React, { useState } from 'react'
import styled from '@emotion/styled'

import { dispatch, NAVIGATE_TO_STRONG } from './dispatch'

const scaleFontSize = (value, scale) => `${value + scale * 0.1 * value}px` // Scale

const Wrapper = styled('div')(({ settings: { textDisplay } }) => ({
  display: textDisplay,
  flexDirection: 'row',
  flexWrap: 'wrap'
}))

const Section = styled('div')(({ isFocused }) => ({
  paddingRight: 10,
  paddingBottom: 10,
  display: 'inline-block',
  background: isFocused ? 'rgba(0,0,0,0.1)' : 'transparent',
  transition: 'background 0.3s ease'
}))

const NumberText = styled('span')(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(15, fontSizeScale),
  display: 'inline-block',
  position: 'relative',
  paddingRight: 10,
  bottom: 10,
  fontFamily: 'LiterataBook'
}))

const Hebreu = styled('div')(({ settings: { fontSizeScale, theme, colors } }) => ({
  fontSize: scaleFontSize(20, fontSizeScale),
  fontFamily: 'LiterataBook',
  color: colors[theme].default
}))

const Code = styled('div')(({ settings: { fontSizeScale, theme, colors } }) => ({
  fontSize: scaleFontSize(11, fontSizeScale),
  fontFamily: 'arial',
  color: 'rgba(0,0,0,0.3)'
}))

const Mot = styled('div')(({ settings: { fontSizeScale, theme, colors } }) => ({
  fontSize: scaleFontSize(16, fontSizeScale),
  fontFamily: 'LiterataBook',
  color: colors[theme].quart,
  marginTop: 5 + fontSizeScale * 0.1 * 5
}))

const ParsingTag = styled('div')(({ settings: { fontSizeScale, theme, colors } }) => ({
  fontSize: scaleFontSize(10, fontSizeScale),
  lineHeight: scaleFontSize(20, fontSizeScale),
  fontFamily: 'arial',
  color: 'rgba(0,0,0,0.3)'
}))

const InterlinearVerse = ({ verse, settings, isHebreu }) => {
  const [isFocused, setIsFocused] = useState(false)

  const onTouchStart = i => {
    setIsFocused(i)
  }

  const onTouchEnd = () => {
    setIsFocused(false)
  }

  const onTouchMove = e => {
    setIsFocused(false)
  }

  const navigateToStrong = (reference, isHebreu) => {
    dispatch({
      type: NAVIGATE_TO_STRONG,
      payload: { reference, book: isHebreu ? 1 : 40 }
    })
  }

  const sections = verse.Texte.split('@')
  return (
    <Wrapper settings={settings} id={`verset-${verse.Verset}`}>
      <NumberText settings={settings}>{verse.Verset} </NumberText>
      {sections.map((section, i) => {
        const [code, hebreu, mot, parsingTag] = section.split('#')
        return (
          <Section
            key={i}
            onClick={() => navigateToStrong(code, isHebreu)}
            isFocused={isFocused === i}
            onTouchStart={() => onTouchStart(i)}
            onTouchEnd={onTouchEnd}
            onTouchMove={onTouchMove}>
            {/* <Code settings={settings}>{code}</Code> */}
            <Hebreu settings={settings}>{hebreu}</Hebreu>
            <Mot settings={settings}>{mot}</Mot>
            {parsingTag && <ParsingTag settings={settings}>{parsingTag}</ParsingTag>}
          </Section>
        )
      })}
    </Wrapper>
  )
}

export default InterlinearVerse
