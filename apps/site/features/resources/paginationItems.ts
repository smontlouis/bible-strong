/** A page number, or a gap standing for the pages left out between two numbers. */
export type PaginationItem = number | 'gap'

/**
 * The page numbers to offer around the current one: the first, the last and a window of
 * neighbours, with a gap wherever pages are left out.
 */
export const paginationItems = (current: number, pageCount: number, neighbours = 2): PaginationItem[] => {
  const pages = new Set<number>([1, pageCount])
  for (let page = current - neighbours; page <= current + neighbours; page += 1) {
    if (page >= 1 && page <= pageCount) pages.add(page)
  }
  const items: PaginationItem[] = []
  let previous = 0
  for (const page of [...pages].sort((left, right) => left - right)) {
    // A single missing page is shown rather than replaced by a gap of the same width.
    if (page - previous === 2) items.push(page - 1)
    else if (page - previous > 2) items.push('gap')
    items.push(page)
    previous = page
  }
  return items
}
