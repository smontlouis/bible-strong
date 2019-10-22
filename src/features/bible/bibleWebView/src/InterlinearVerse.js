import React, { useState } from 'react'
import styled from '@emotion/styled'

import { dispatch, NAVIGATE_TO_STRONG } from './dispatch'

const scaleFontSize = (value, scale) => `${value + scale * 0.1 * value}px` // Scale

const Wrapper = styled('div')(({ settings: { textDisplay } }) => ({
  display: textDisplay
}))

const Section = styled('div')(({ isFocused, isHebreu }) => ({
  display: 'inline-block',
  background: isFocused ? 'rgba(0,0,0,0.1)' : 'transparent',
  transition: 'background 0.3s ease',
  borderRadius: 4,
  padding: 5
}))

const NumberText = styled('span')(({ settings: { fontSizeScale }, isHebreu }) => ({
  fontSize: scaleFontSize(15, fontSizeScale),
  position: 'relative',
  bottom: 20,
  fontFamily: 'LiterataBook',
  padding: '0 5px',

  display: 'inline-flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center'
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

const VerseText = styled('div')(({ settings: { fontSizeScale, theme, colors } }) => ({
  fontSize: scaleFontSize(16, fontSizeScale),
  lineHeight: scaleFontSize(25, fontSizeScale),
  fontFamily: 'LiterataBook',
  direction: 'ltr',
  textAlign: 'left',
  padding: '10px',
  margin: '10px 0',
  background: colors[theme].lightGrey,
  borderRadius: 4
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

const InterlinearVerse = ({ verse, settings, isHebreu, secondaryVerse }) => {
  const [isFocused, setIsFocused] = useState(false)
  const [showSecondaryVerse, setShowSecondaryVerse] = useState(false)

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
      {secondaryVerse && showSecondaryVerse && (
        <VerseText settings={settings}>
          {secondaryVerse.Verset} {secondaryVerse.Texte}
        </VerseText>
      )}
      <NumberText
        isHebreu={isHebreu}
        settings={settings}
        onClick={() => setShowSecondaryVerse(s => !s)}>
        <svg width={15} x="0px" y="0px" viewBox="0 0 54.308 54.308">
          <path
            fill="#010002"
            d="M53.583,25.902c-5.448-9.413-15.575-15.26-26.429-15.26S6.173,16.489,0.725,25.902L0,27.154
		l0.725,1.252c5.447,9.413,15.574,15.26,26.429,15.26s20.981-5.847,26.429-15.26l0.725-1.252L53.583,25.902z M5.826,27.154
		c2.187-3.319,5.102-6.031,8.452-7.993c-1.198,2.126-1.889,4.574-1.889,7.183c0,3.778,1.446,7.215,3.797,9.821
		C12.031,34.179,8.419,31.089,5.826,27.154z M37.843,36.302c2.426-2.621,3.922-6.114,3.922-9.958c0-0.999-0.102-1.974-0.293-2.917
		c-0.432,1.268-1.207,2.377-2.222,3.208c-0.762,0.624-1.658,1.086-2.635,1.351c-0.594,0.161-1.216,0.255-1.86,0.255
		c-3.922,0-7.101-3.179-7.101-7.101c0-1.605,0.539-3.08,1.436-4.269c0.289-0.383,0.615-0.735,0.974-1.052
		c1.55,0.18,3.069,0.503,4.543,0.956c1.81,0.557,3.547,1.314,5.184,2.249c0.687,0.393,1.36,0.811,2.008,1.266
		c2.608,1.829,4.888,4.145,6.681,6.865C45.83,31.178,42.117,34.323,37.843,36.302z"
          />
        </svg>
        {verse.Verset}{' '}
      </NumberText>
      {sections.map((section, i) => {
        const [code, hebreu, mot, parsingTag] = section.split('#')
        return (
          <Section
            isHebreu={isHebreu}
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
