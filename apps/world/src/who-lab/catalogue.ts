import type { CatalogueIdentity } from '../game-catalogue'
export type Identity = CatalogueIdentity
const files = import.meta.glob<Identity[]>('../../who-bank/*.json', {
  eager: true,
  import: 'default',
})
// The original pilot stays batch 1; additions form four editorial batches of 30.
export function batchForIdentity(q: Pick<Identity, 'id' | 'category'>) {
  const number = Number(q.id.split('-').at(-1))
  if (number <= 10) return 1
  const size = { person: 17, place: 8, object: 5 }[q.category]
  return Math.min(5, 2 + Math.floor((number - 11) / size))
}
const previousLimits = { person: 80, place: 40, object: 30 }
let additionIndex = 0
export const identities = Object.values(files)
  .flat()
  .sort((a, b) => a.id.localeCompare(b.id))
  .map(q => ({
    ...q,
    batch:
      Number(q.id.split('-').at(-1)) > previousLimits[q.category]
        ? 6 + Math.floor(additionIndex++ / 30)
        : batchForIdentity(q),
  }))
  .sort((a, b) => a.batch - b.batch || a.id.localeCompare(b.id))

export const reviewBatches = [...new Set(identities.map(q => q.batch))]
