import React from 'react'

export const selectRetainedCommentaryContent = <T>(
  lastReadyContent: T | undefined,
  requestedContent: T,
  requestedContentReady: boolean
) => (requestedContentReady || lastReadyContent === undefined ? requestedContent : lastReadyContent)

const useRetainedCommentaryContent = <T>(requestedContent: T, requestedContentReady: boolean) => {
  const [lastReadyContent, setLastReadyContent] = React.useState<T | undefined>(undefined)

  React.useEffect(() => {
    if (requestedContentReady) setLastReadyContent(requestedContent)
  }, [requestedContent, requestedContentReady])

  return selectRetainedCommentaryContent(lastReadyContent, requestedContent, requestedContentReady)
}

export default useRetainedCommentaryContent
