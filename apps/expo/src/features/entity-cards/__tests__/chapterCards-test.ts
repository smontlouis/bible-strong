import type { EntityPortraitCatalog } from '~features/lexique/entityPortraits'

import { GOD_ENTITY, getChapterCardId, getChapterNewCards, isCardCollected } from '../chapterCards'

const ABRAHAM = 'Abraham@Gen.11.26-1Pe'

const portraits: EntityPortraitCatalog = {
  entities: {
    [ABRAHAM]: {
      hash: 'aaaaaaaaaaaa',
      stages: [
        {
          key: 'abram',
          label: { fr: 'Abram', en: 'Abram' },
          hash: 'bbbbbbbbbbbb',
          ranges: [{ book: 1, from: 12, to: 16 }],
        },
        {
          // Starts in the middle of chapter 17: it does not stand for the whole chapter.
          key: 'alliance',
          label: { fr: 'Alliance', en: 'Covenant' },
          hash: 'cccccccccccc',
          ranges: [{ book: 1, from: 17, to: 17, fromVerse: 5, toVerse: 27 }],
        },
      ],
    },
    [GOD_ENTITY]: { hash: 'dddddddddddd' },
  },
  series: [],
  roles: {},
}

const cardIds = new Set([ABRAHAM, `${ABRAHAM}~abram`, `${ABRAHAM}~alliance`, GOD_ENTITY])

describe('the cards of a chapter', () => {
  it('offers the card of the life stage that covers the chapter', () => {
    const at = (chapter: number) =>
      getChapterCardId({ uniqueName: ABRAHAM, portraits, cardIds, book: 1, chapter })
    expect(at(12)).toBe(`${ABRAHAM}~abram`)
    expect(at(17)).toBe(ABRAHAM)
    expect(at(22)).toBe(ABRAHAM)
  })

  it('offers nothing for an entity without a card', () => {
    expect(
      getChapterCardId({
        uniqueName: 'Lot@Gen.11.27-2Pe',
        portraits,
        cardIds,
        book: 1,
        chapter: 12,
      })
    ).toBeUndefined()
  })

  it('marks new the cards not collected, never God’s', () => {
    const uniqueNames = [ABRAHAM, GOD_ENTITY]
    expect(
      getChapterNewCards({ uniqueNames, portraits, cardIds, collected: {}, book: 1, chapter: 12 })
    ).toEqual({ [ABRAHAM]: `${ABRAHAM}~abram` })
    expect(
      getChapterNewCards({
        uniqueNames,
        portraits,
        cardIds,
        collected: { [`${ABRAHAM}~abram`]: 1 },
        book: 1,
        chapter: 12,
      })
    ).toEqual({})
    // The base card collected leaves the stage card new.
    expect(
      getChapterNewCards({
        uniqueNames,
        portraits,
        cardIds,
        collected: { [ABRAHAM]: 1 },
        book: 1,
        chapter: 12,
      })
    ).toEqual({ [ABRAHAM]: `${ABRAHAM}~abram` })
  })

  it('holds God’s cards collected from the start', () => {
    expect(isCardCollected(GOD_ENTITY, {})).toBe(true)
    expect(isCardCollected(`${GOD_ENTITY}~buisson`, {})).toBe(true)
    expect(isCardCollected(ABRAHAM, {})).toBe(false)
  })
})
