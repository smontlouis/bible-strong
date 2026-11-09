// An Incoming link opens the browser workspace on a public resource: it becomes a Tab, not a
// route panel beside nothing (ADR-0108). This module reads the address and builds that Tab.

import { bibleRouteInputFromPublicRoute, createBibleRouteTab } from '~features/bible/bibleRouteTab'
import { parsePublicBibleRoute, type PublicBibleRoute } from '~features/bible/publicBibleRoutes'
import { createCommentaryProjectionId } from '~features/commentaries/commentarySelection'
import {
  parsePublicCommentaryRoute,
  type PublicCommentaryRoute,
} from '~features/commentaries/publicCommentaryRoutes'
import {
  parsePublicDictionaryRoute,
  type PublicDictionaryRoute,
} from '~features/dictionnary/publicDictionaryRoutes'
import { parsePublicStrongCode, publicStrongContext } from '~features/lexique/publicStrongRoutes'
import { parsePublicNaveRoute, type PublicNaveRoute } from '~features/nave/publicNaveRoutes'
import {
  parsePublicTimelineRoute,
  type PublicTimelineRoute,
} from '~features/timeline/publicTimelineRoutes'
import generateUUID from '~helpers/generateUUID'
import type { StrongIdentity } from '~helpers/strongIdentities'
import verseToReference from '~helpers/verseToReference'
import i18n from '~i18n'
import { getBibleContextDisplayMode, type TabGroup, type TabItem } from '~state/tabs'

/** The public resource an Incoming link names, when a Tab can show it. */
export type IncomingLinkTarget =
  | { kind: 'bible'; route: PublicBibleRoute }
  | { kind: 'strong'; identity: StrongIdentity }
  | { kind: 'dictionary'; route: PublicDictionaryRoute }
  | { kind: 'nave'; route: PublicNaveRoute }
  | { kind: 'commentary'; route: PublicCommentaryRoute }
  | { kind: 'timeline'; route: PublicTimelineRoute }

const WORKSPACE_ORIGIN = 'https://web.bible-strong.app'

const pathSegments = (pathname: string): string[] | undefined => {
  try {
    return pathname.split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return undefined
  }
}

/**
 * The resource an address of the workspace names, if it opens in a Tab. The pages a Tab
 * cannot show (the concordance or the dictionary of a Strong entry, a biblical entity…) and
 * every other screen keep their route.
 */
export const parseIncomingLink = (address: string): IncomingLinkTarget | undefined => {
  let url: URL
  try {
    url = new URL(address, WORKSPACE_ORIGIN)
  } catch {
    return undefined
  }
  const segments = pathSegments(url.pathname)
  if (!segments?.length) return undefined
  const [family, ...rest] = segments
  const query = (name: string) => url.searchParams.get(name) ?? undefined

  switch (family) {
    case 'bible': {
      const route = parsePublicBibleRoute(rest, query('gloss'))
      return route && { kind: 'bible', route }
    }
    case 'strong': {
      const identity = rest.length === 1 ? parsePublicStrongCode(rest[0]) : undefined
      return identity && { kind: 'strong', identity }
    }
    case 'dictionary': {
      if (rest.length !== 4) return undefined
      const [language, work, entryId, slug] = rest
      const route = parsePublicDictionaryRoute({ language, work, entryId, slug })
      return route && { kind: 'dictionary', route }
    }
    case 'nave': {
      const route = rest.length === 2 ? parsePublicNaveRoute(rest[0], rest[1]) : undefined
      return route && { kind: 'nave', route }
    }
    case 'commentary': {
      if (rest.length !== 4 && rest.length !== 5) return undefined
      const [language, resource, book, chapter, section] = rest
      const route = parsePublicCommentaryRoute({ language, resource, book, chapter, section })
      return route && { kind: 'commentary', route }
    }
    case 'timeline': {
      if (rest.length !== 1 && rest.length !== 2) return undefined
      const route = parsePublicTimelineRoute({ language: rest[0], slug: rest[1] })
      return route && { kind: 'timeline', route }
    }
    default:
      return undefined
  }
}

/** The Tab that shows what an Incoming link names, as its route screen shows it. */
export const createIncomingLinkTab = (target: IncomingLinkTarget): TabItem => {
  switch (target.kind) {
    case 'bible': {
      const input = bibleRouteInputFromPublicRoute(target.route)
      return {
        ...createBibleRouteTab(input),
        title: verseToReference({
          bookNum: target.route.book.Numero,
          chapterNum: target.route.chapter,
          ...(input.focusVerses ? { verses: input.focusVerses } : {}),
        }),
      }
    }
    case 'strong':
      return {
        id: `strong-${generateUUID()}`,
        title: target.identity.code,
        isRemovable: true,
        type: 'strong',
        data: publicStrongContext(target.identity),
      }
    case 'dictionary': {
      const { language, work, entryId, slug } = target.route
      return {
        id: `dictionary-${generateUUID()}`,
        title: i18n.t('tabs.dictionary'),
        isRemovable: true,
        type: 'dictionary',
        data: { language, work, entryId, word: slug },
      }
    }
    case 'nave':
      return {
        id: `nave-${generateUUID()}`,
        title: target.route.topic,
        isRemovable: true,
        type: 'nave',
        data: {
          language: target.route.language,
          name_lower: target.route.topic,
          name: target.route.topic,
        },
      }
    case 'commentary': {
      const { resourceId, language, book, chapter, sectionId } = target.route
      return {
        id: `commentary-resource-${generateUUID()}`,
        title: verseToReference({ bookNum: book, chapterNum: chapter }),
        isRemovable: true,
        type: 'commentary-resource',
        data: {
          projectionId: createCommentaryProjectionId(resourceId, language),
          book,
          chapter,
          ...(sectionId ? { sectionId } : {}),
        },
      }
    }
    case 'timeline':
      return {
        id: `timeline-${generateUUID()}`,
        title: i18n.t('Chronologie de la Bible'),
        isRemovable: true,
        type: 'timeline',
        data: {
          language: target.route.language,
          ...(target.route.slug ? { eventSlug: target.route.slug } : {}),
        },
      }
  }
}

const versesSignature = (verses: (string | number)[] | undefined) =>
  (verses ?? [])
    .map(Number)
    .sort((left, right) => left - right)
    .join(',')

const sameCode = (left: string | undefined, right: string | undefined) =>
  !!left && !!right && left.toLocaleUpperCase() === right.toLocaleUpperCase()

/**
 * Whether two Tabs show exactly the same thing. An Incoming link selects such a Tab rather
 * than opening a second one; a Tab showing the same resource otherwise (another verse in
 * focus, another presentation, parallel versions…) is not the same.
 */
export const isSameTabContent = (left: TabItem, right: TabItem): boolean => {
  if (left.type === 'bible' && right.type === 'bible') {
    const a = left.data
    const b = right.data
    const displayMode = getBibleContextDisplayMode(a)
    const interlinearMode = a.interlinearMode ?? 'hidden'
    const strongMode = a.strongMode ?? 'hidden'
    const readsGlosses = interlinearMode !== 'hidden' || strongMode === 'reverse-interlinear'
    return (
      a.selectedVersion === b.selectedVersion &&
      a.selectedBook.Numero === b.selectedBook.Numero &&
      a.selectedChapter === b.selectedChapter &&
      displayMode === getBibleContextDisplayMode(b) &&
      (displayMode === 'fullChapter' ||
        versesSignature(a.focusVerses) === versesSignature(b.focusVerses)) &&
      strongMode === (b.strongMode ?? 'hidden') &&
      interlinearMode === (b.interlinearMode ?? 'hidden') &&
      (!readsGlosses || a.interlinearLocale === b.interlinearLocale) &&
      !a.parallelVersions.length &&
      !b.parallelVersions.length &&
      !a.planPassage &&
      !b.planPassage
    )
  }
  if (left.type === 'strong' && right.type === 'strong') {
    return sameCode(
      left.data.identityCode ?? left.data.reference,
      right.data.identityCode ?? right.data.reference
    )
  }
  if (left.type === 'dictionary' && right.type === 'dictionary') {
    return (
      left.data.language === right.data.language &&
      left.data.work === right.data.work &&
      left.data.entryId !== undefined &&
      left.data.entryId === right.data.entryId
    )
  }
  if (left.type === 'nave' && right.type === 'nave') {
    return (
      left.data.language === right.data.language &&
      !!left.data.name_lower &&
      left.data.name_lower === right.data.name_lower
    )
  }
  if (left.type === 'commentary-resource' && right.type === 'commentary-resource') {
    return (
      left.data.projectionId === right.data.projectionId &&
      left.data.book === right.data.book &&
      left.data.chapter === right.data.chapter &&
      left.data.sectionId === right.data.sectionId
    )
  }
  if (left.type === 'timeline' && right.type === 'timeline') {
    return (
      left.data.language === right.data.language && left.data.eventSlug === right.data.eventSlug
    )
  }
  return false
}

/** A Tab that already shows what `tab` shows: in the active group first, then in the others. */
export const findTabWithSameContent = (
  groups: readonly TabGroup[],
  activeGroupId: string,
  tab: TabItem
): { groupId: string; tabId: string } | undefined => {
  const ordered = [
    ...groups.filter(group => group.id === activeGroupId),
    ...groups.filter(group => group.id !== activeGroupId),
  ]
  for (const group of ordered) {
    const match = group.tabs.find(candidate => isSameTabContent(candidate, tab))
    if (match) return { groupId: group.id, tabId: match.id }
  }
  return undefined
}
