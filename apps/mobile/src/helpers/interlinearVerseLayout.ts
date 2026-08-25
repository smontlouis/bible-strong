import type { InterlinearToken } from './interlinearBibleSidecar'

interface VerseOffsetToken {
  startOffset: number
  length: number
}

export interface TokenizedVersePiece<Token extends VerseOffsetToken> {
  prefix: string
  surface: string
  token: Token
}

export interface TokenizedVerseLayout<Token extends VerseOffsetToken> {
  pieces: TokenizedVersePiece<Token>[]
  trailing: string
}

export const buildTokenizedVerseLayout = <Token extends VerseOffsetToken>(
  text: string,
  tokens: Token[]
): TokenizedVerseLayout<Token> => {
  const pieces: TokenizedVersePiece<Token>[] = []
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

export const buildInterlinearVerseLayout = (text: string, tokens: InterlinearToken[]) =>
  buildTokenizedVerseLayout(text, tokens)
