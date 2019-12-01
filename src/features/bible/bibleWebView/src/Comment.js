import React, { useState, useEffect, useRef } from 'react'
import truncHTML from 'trunc-html'
import styled from '@emotion/styled'
import { dispatch, NAVIGATE_TO_BIBLE_VIEW } from './dispatch'

import { scaleFontSize } from './scaleFontSize'

export function usePrevious(value) {
  const ref = useRef()
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

const StyledComment = styled('div')(({ settings: { fontSizeScale, theme, colors } }) => ({
  padding: scaleFontSize(14, fontSizeScale),
  margin: '10px 0',
  background: colors[theme].lightGrey,
  borderRadius: 4,
  position: 'relative',
  overflow: 'hidden',
  textAlign: 'left',

  p: {
    fontSize: scaleFontSize(17, fontSizeScale),
    lineHeight: scaleFontSize(25, fontSizeScale),
    fontFamily: 'LiterataBook',
    margin: 0
  },
  li: {
    fontFamily: 'LiterataBook'
  },
  'p+p': {
    marginTop: scaleFontSize(25, fontSizeScale)
  },
  h3: {
    fontFamily: 'LiterataBook',
    margin: 0,
    paddingBottom: scaleFontSize(25, fontSizeScale),
    fontSize: scaleFontSize(18, fontSizeScale)
  },
  a: {
    color: colors[theme].primary
  }
}))

const ReadMore = styled('div')(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(15, fontSizeScale),
  fontFamily: 'LiterataBook',
  textAlign: 'center',
  margin: '0',
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}))

const Intro = styled('div')(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(15, fontSizeScale),
  fontFamily: 'LiterataBook',
  textAlign: 'center',
  paddingBottom: scaleFontSize(20, fontSizeScale),
  paddingTop: scaleFontSize(15, fontSizeScale)
}))

const Copyright = styled('div')(({ settings: { theme, colors, fontSizeScale } }) => ({
  fontSize: scaleFontSize(10, fontSizeScale),
  fontFamily: 'LiterataBook',
  textAlign: 'center',
  color: colors[theme].darkGrey,
  paddingBottom: scaleFontSize(5, fontSizeScale),
  paddingTop: scaleFontSize(5, fontSizeScale)
}))

const MAX_CHAR = 100

const Comment = ({ id, settings, comment, isIntro }) => {
  const [readMore, setReadMore] = useState(false)
  const [mhyComment, setComment] = useState(
    truncHTML(comment.replace(/&amp;nbsp;/g, ' '), MAX_CHAR).html
  )
  const previousReadMore = usePrevious(readMore)
  const previousComment = usePrevious(comment)

  const onReadMore = () => {
    setReadMore(s => !s)
  }

  useEffect(() => {
    document.querySelectorAll(`#${id} a`).forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault()

        const href = e.target.attributes.href.textContent
        const bookCode = href.substr(0, 3)
        const splittedHref = href.substr(3).split('.')
        const [chapter] = splittedHref
        let [, verse] = splittedHref

        if (verse.includes('-')) {
          ;[verse] = verse.split('-')
        }

        dispatch({
          type: NAVIGATE_TO_BIBLE_VIEW,
          bookCode,
          chapter,
          verse
        })
      })
    })
  }, [mhyComment, id])

  useEffect(() => {
    if (previousComment !== comment) {
      setComment(truncHTML(comment.replace(/&amp;nbsp;/g, ' '), MAX_CHAR).html)
      setReadMore(false)
      return
    }

    if (readMore) {
      setComment(comment.replace(/&amp;nbsp;/g, ' '))
      return
    }
    if (previousReadMore && !readMore) {
      setComment(truncHTML(comment.replace(/&amp;nbsp;/g, ' '), MAX_CHAR).html)
      document.getElementById(id).scrollIntoView()
    }
  }, [comment, id, previousComment, previousReadMore, readMore])

  return (
    <StyledComment id={id} settings={settings}>
      {/* <Copyright settings={settings}>Matthew Henry trad. Dominique Osché</Copyright> */}

      {isIntro && <Intro settings={settings}>Introduction</Intro>}
      <div dangerouslySetInnerHTML={{ __html: mhyComment }} />
      <ReadMore onClick={onReadMore} settings={settings}>
        {readMore ? '- Lire moins -' : '- Lire plus -'}
      </ReadMore>
    </StyledComment>
  )
}

export default Comment
