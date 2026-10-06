import { useI18n } from '@/locales'
import { paginationItems } from './paginationItems'

/** Numbered pages of a list, each a plain link, with the previous and next ones. */
export default function Pagination({
  current,
  pageCount,
  hrefFor,
}: {
  current: number
  pageCount: number
  hrefFor: (page: number) => string
}) {
  const t = useI18n()
  if (pageCount < 2) return null
  const pageLabel = (page: number) => t('pagination.page').replace('{page}', String(page))

  return (
    <nav className="resource-pagination" aria-label={t('pagination.label')}>
      {current > 1 && (
        <a className="resource-pagination__step" href={hrefFor(current - 1)} rel="prev">
          ← {t('pagination.previous')}
        </a>
      )}
      <ol className="resource-pagination__pages">
        {paginationItems(current, pageCount).map((item, index) =>
          item === 'gap' ? (
            <li key={`gap-${index}`} className="resource-pagination__gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item}>
              <a
                className="resource-pagination__page"
                aria-current={item === current ? 'page' : undefined}
                aria-label={pageLabel(item)}
                href={hrefFor(item)}
              >
                {item}
              </a>
            </li>
          )
        )}
      </ol>
      {current < pageCount && (
        <a className="resource-pagination__step" href={hrefFor(current + 1)} rel="next">
          {t('pagination.next')} →
        </a>
      )}
    </nav>
  )
}
