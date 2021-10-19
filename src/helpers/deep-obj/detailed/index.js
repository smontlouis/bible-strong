import addedDiff from '../added'
import deletedDiff from '../deleted'
import updatedDiff from '../updated'

const detailedDiff = (lhs, rhs, replace) => ({
  added: addedDiff(lhs, rhs),
  deleted: deletedDiff(lhs, rhs, replace),
  updated: updatedDiff(lhs, rhs),
})

export default detailedDiff
