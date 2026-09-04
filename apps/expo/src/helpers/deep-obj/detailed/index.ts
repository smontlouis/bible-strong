import addedDiff from '../added'
import deletedDiff from '../deleted'
import updatedDiff from '../updated'

interface DetailedDiffResult {
  added: Record<string, unknown>
  deleted: Record<string, unknown>
  updated: unknown
}

const detailedDiff = (lhs: unknown, rhs: unknown, replace?: unknown): DetailedDiffResult => ({
  added: addedDiff(lhs, rhs),
  deleted: deletedDiff(lhs, rhs, replace),
  updated: updatedDiff(lhs, rhs),
})

export default detailedDiff
