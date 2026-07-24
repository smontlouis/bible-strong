import type { InterlinearToken } from './interlinearBibleSidecar'

export interface InterlinearVersePiece {
  prefix: string
  surface: string
  token: InterlinearToken
}

export interface InterlinearVerseLayout {
  pieces: InterlinearVersePiece[]
  trailing: string
}

export const buildInterlinearVerseLayout = (
  text: string,
  tokens: InterlinearToken[]
): InterlinearVerseLayout => {
  const pieces: InterlinearVersePiece[] = []
  let consumedOffset = 0

  for (const token of [...tokens].sort((left, right) => left.startOffset - right.startOffset)) {
    const tokenEnd = token.startOffset + token.length
    if (
      token.startOffset < consumedOffset ||
      token.startOffset < 0 ||
      token.length < 0 ||
      tokenEnd > text.length
    ) {
      continue
    }
    pieces.push({
      prefix: text.slice(consumedOffset, token.startOffset),
      surface: text.slice(token.startOffset, tokenEnd),
      token,
    })
    consumedOffset = tokenEnd
  }

  return {
    pieces,
    trailing: text.slice(consumedOffset),
  }
}
