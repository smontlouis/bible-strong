/**
 * A verse as the reader shows it: parallel reading shows the same verse key in several versions.
 */
export interface VerseTarget {
  verseKey: string
  version: string
  /** Parallel reading: the column the verse is shown in, since a version can be shown twice */
  column?: number
}

/** One string per verse of one column, for state that tracks a single touched or tapped verse. */
export const createVerseCellKey = ({ verseKey, version, column }: VerseTarget) =>
  `${version}:${column ?? ''}:${verseKey}`

/** Whether two targets are the same column of the same version. */
export const isSameVerseColumn = (
  a: Pick<VerseTarget, 'version' | 'column'>,
  b: Pick<VerseTarget, 'version' | 'column'>
) => a.version === b.version && a.column === b.column

const getVerseTextSelector = (version: string, verseKey: string, column?: number) =>
  `[data-verse-text][data-version="${version}"][data-verse-key="${verseKey}"]` +
  (column === undefined ? '' : `[data-column="${column}"]`)

/** The text element of one verse in one version. */
export function findVerseTextElement(version: string, verseKey: string): Element | null {
  return document.querySelector(getVerseTextSelector(version, verseKey))
}

/**
 * Every text element of one verse in one version: parallel reading can show a version twice.
 * With a column, only the one shown in that column.
 */
export function findVerseTextElements(
  version: string,
  verseKey: string,
  column?: number
): Element[] {
  return Array.from(document.querySelectorAll(getVerseTextSelector(version, verseKey, column)))
}

/** The verse, version and parallel column a verse text element shows. */
export function getVerseTarget(verseContainer: Element | null): VerseTarget | null {
  const verseKey = verseContainer?.getAttribute('data-verse-key')
  const version = verseContainer?.getAttribute('data-version')
  if (!verseKey || !version) return null

  const column = Number.parseInt(verseContainer?.getAttribute('data-column') ?? '', 10)
  return Number.isNaN(column) ? { verseKey, version } : { verseKey, version, column }
}
