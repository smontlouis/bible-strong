import type { Question } from './model'

// Kept exclusively in the development review entry, never imported by the live game.
const files = import.meta.glob<Question[]>('../../question-bank/*.json', {
  eager: true,
  import: 'default',
})
export const catalogue: (Question & { batch: number })[] = Object.entries(files)
  .flatMap(([path, questions]) =>
    questions.map(q => ({ ...q, batch: Number(path.match(/-(\d+)\.json$/)?.[1] ?? 1) }))
  )
  .sort(
    (a, b) =>
      a.batch - b.batch ||
      ['easy', 'medium', 'hard'].indexOf(a.difficulty) -
        ['easy', 'medium', 'hard'].indexOf(b.difficulty) ||
      ['old', 'new'].indexOf(a.testament) - ['old', 'new'].indexOf(b.testament) ||
      a.id.localeCompare(b.id)
  )

export const batches = [...new Set(catalogue.map(q => q.batch))].sort((a, b) => a - b)
