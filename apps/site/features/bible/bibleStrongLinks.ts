import {
  getDisplayedStrongIdentities,
  STRONG_IDENTITY_KINDS,
  type StrongIdentity,
} from '@bible-strong/resource-domain/strong-identities'
import type { ResourceLanguage } from '../resources/publicSite'
import { buildStrongPath, displayStrongNumber, parseStrongCode } from '../strong/strongRoutes'

export type BibleStrongLink = {
  /** The code of the sense the word has in the verse, which names its entry. */
  code: string
  path: string
  /** The classical number shown to the reader. */
  label: string
}

type TaggedIdentity = { kind: string; code: string }

const isStrongIdentity = (identity: TaggedIdentity): identity is StrongIdentity =>
  (STRONG_IDENTITY_KINDS as readonly string[]).includes(identity.kind)

const strongFamily = (code: string): string =>
  displayStrongNumber(parseStrongCode(code)?.code ?? code)

/**
 * The entries behind a word. A word is tagged with its classical number and, where the
 * lexicon tells senses apart, with the sense it has in that verse: the link opens the most
 * precise one, as the study workspace does, and shows the classical number. A compound word
 * carries several, kept in the order of the text.
 */
export const bibleStrongLinks = (
  identities: readonly TaggedIdentity[],
  language: ResourceLanguage
): BibleStrongLink[] => {
  const tagged = identities.filter(isStrongIdentity)
  const position = (code: string) =>
    tagged.findIndex(identity => strongFamily(identity.code) === strongFamily(code))
  const links = getDisplayedStrongIdentities(tagged)
    .sort((left, right) => position(left.code) - position(right.code))
    .flatMap(identity => {
      const code = parseStrongCode(identity.code)?.code
      return code
        ? [{ code, path: buildStrongPath(language, code), label: displayStrongNumber(code) }]
        : []
    })
  return links.filter((link, index) => links.findIndex(other => other.code === link.code) === index)
}
