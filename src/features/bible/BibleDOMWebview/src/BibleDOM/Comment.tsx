import { styled } from 'goober'
import { NAVIGATE_TO_BIBLE_VIEW } from './dispatch'

import { scaleFontSize } from './scaleFontSize'
import { useEffect, useRef, useState } from 'react'
import { RootStyles } from './BibleDOMWrapper'
import { RootState } from '../../../../../redux/modules/reducer'
import { useDispatch } from './DispatchProvider'

export function usePrevious<T>(value: T) {
  const ref = useRef<T>()
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

const StyledComment = styled('div')<RootStyles>(
  ({ settings: { fontSizeScale, fontFamily, theme, colors } }) => ({
    padding: scaleFontSize(14, fontSizeScale),
    margin: '10px 0',
    background: colors[theme].lightGrey,
    borderRadius: '4px',
    position: 'relative',
    overflow: 'hidden',
    textAlign: 'left',

    p: {
      fontSize: scaleFontSize(17, fontSizeScale),
      lineHeight: scaleFontSize(25, fontSizeScale),
      fontFamily,
      margin: 0,
    },
    li: {
      fontFamily,
    },
    'p+p': {
      marginTop: scaleFontSize(25, fontSizeScale),
    },
    h3: {
      fontFamily,
      margin: 0,
      paddingBottom: scaleFontSize(25, fontSizeScale),
      fontSize: scaleFontSize(18, fontSizeScale),
    },
    a: {
      color: colors[theme].primary,
    },
  })
)

const ReadMore = styled('div')<RootStyles>(({ settings: { fontSizeScale, fontFamily } }) => ({
  fontSize: scaleFontSize(15, fontSizeScale),
  fontFamily,
  textAlign: 'center',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '20px 0',
}))

const Intro = styled('div')<RootStyles>(({ settings: { fontSizeScale, fontFamily } }) => ({
  fontSize: scaleFontSize(15, fontSizeScale),
  fontFamily,
  textAlign: 'center',
  paddingBottom: scaleFontSize(20, fontSizeScale),
  paddingTop: scaleFontSize(15, fontSizeScale),
}))

const Copyright = styled('div')<RootStyles>(
  ({ settings: { theme, colors, fontSizeScale, fontFamily } }) => ({
    fontSize: scaleFontSize(10, fontSizeScale),
    fontFamily,
    textAlign: 'center',
    color: colors[theme].darkGrey,
    paddingBottom: scaleFontSize(5, fontSizeScale),
    paddingTop: scaleFontSize(5, fontSizeScale),
  })
)

const MAX_CHAR = 100

interface Props {
  id: string
  settings: RootState['user']['bible']['settings']
  comment: string
  isIntro?: boolean
}

const Comment = ({ id, settings, comment, isIntro }: Props) => {
  const dispatch = useDispatch()
  const [readMore, setReadMore] = useState(false)
  const [mhyComment, setComment] = useState(comment.replace(/&amp;nbsp;/g, ' '))
  const previousReadMore = usePrevious(readMore)
  const previousComment = usePrevious(comment)

  const onReadMore = () => {
    setReadMore(s => !s)
  }

  useEffect(() => {
    document.querySelectorAll(`#${id} a`).forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault()
        //@ts-ignore
        const href = (e.target as HTMLLinkElement).attributes.href.textContent
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
          verse,
        })
      })
    })
  }, [mhyComment, id, readMore])

  useEffect(() => {
    if (previousComment !== comment) {
      setComment(comment.replace(/&amp;nbsp;/g, ' '))
      setReadMore(false)
      return
    }

    if (readMore) {
      setComment(comment.replace(/&amp;nbsp;/g, ' '))
      return
    }
    if (previousReadMore && !readMore) {
      document.getElementById(id)?.scrollIntoView()
    }
  }, [comment, id, previousComment, previousReadMore, readMore])

  return (
    <div id={id}>
      {/* <Copyright settings={settings}>Matthew Henry trad. Dominique Osché</Copyright> */}
      {readMore && (
        <StyledComment settings={settings}>
          {isIntro && <Intro settings={settings}>Introduction</Intro>}
          <div dangerouslySetInnerHTML={{ __html: mhyComment }} style={{ paddingBottom: 20 }} />
        </StyledComment>
      )}
      <ReadMore onClick={onReadMore} settings={settings}>
        {readMore ? '- Fermer -' : '- Lire le commentaire -'}
      </ReadMore>
    </div>
  )
}

export default Comment
