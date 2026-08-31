import React from 'react'

export const selectRetainedCommentaryContent = <T>(
  lastReadyContent: T | undefined,
  requestedContent: T,
  requestedContentReady: boolean
) => (requestedContentReady || lastReadyContent === undefined ? requestedContent : lastReadyContent)

const useRetainedCommentaryContent = <T>(requestedContent: T, requestedContentReady: boolean) => {
  const lastReadyContentRef = React.useRef<T | undefined>(undefined)

  React.useEffect(() => {
    if (requestedContentReady) lastReadyContentRef.current = requestedContent
  }, [requestedContent, requestedContentReady])

  return selectRetainedCommentaryContent(
    lastReadyContentRef.current,
    requestedContent,
    requestedContentReady
  )
}

export default useRetainedCommentaryContent
