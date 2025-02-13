import { WebViewProps } from '../../../../features/bible/BibleDOM/BibleDOMWrapper'
import { Dispatch } from '../../../../features/bible/BibleDOM/BibleDOMWrapper'
import { useEffect, useState } from 'react'
import BibleDOMComponent from './BibleDOM/BibleDOMComponent'
type StateProps = Pick<
  WebViewProps,
  | 'verses'
  | 'parallelVerses'
  | 'focusVerses'
  | 'secondaryVerses'
  | 'selectedVerses'
  | 'highlightedVerses'
  | 'notedVerses'
  | 'settings'
  | 'verseToScroll'
  | 'isReadOnly'
  | 'version'
  | 'pericopeChapter'
  | 'chapter'
  | 'isSelectionMode'
  | 'selectedCode'
  | 'comments'
> & {
  dispatch: Dispatch
}

const BibleDOMComponentWrapper = () => {
  const [state, setState] = useState<StateProps | undefined>(undefined)

  useEffect(() => {
    document.addEventListener('message', event => {
      try {
        const response = (event as any).data

        switch (response.type) {
          case 'SEND_INITIAL_DATA': {
            const {
              verses,
              parallelVerses,
              focusVerses,
              secondaryVerses,
              comments,
              selectedVerses,
              highlightedVerses,
              notedVerses,
              settings,
              verseToScroll,
              version,
              pericopeChapter,
              chapter,
              isSelectionMode,
              selectedCode,
              isReadOnly,
              dispatch,
            } = response

            setState({
              verses,
              parallelVerses,
              focusVerses,
              secondaryVerses,
              selectedVerses,
              highlightedVerses,
              notedVerses,
              settings,
              verseToScroll,
              version,
              pericopeChapter,
              chapter,
              isSelectionMode,
              selectedCode,
              comments,
              isReadOnly,
              dispatch,
            })
            break
          }
          default:
            break
        }
      } catch (err) {}
    })
  }, [])

  if (!state) return null
  return <BibleDOMComponent {...state} />
}

export default BibleDOMComponentWrapper
