// The tab sync takes the groups it finds when it starts as already in Firestore, and the first
// snapshot of the server puts its own version back. A group changed before the sync of the
// account starts, such as the Tab an Incoming link opens at launch (ADR-0108), is named here so
// that the sync sends it instead.

const changedGroups = new Map<string, Set<string>>()

/** Names a group of the signed-in account changed before its tab sync started. */
export const markTabGroupChangedBeforeSync = (userId: string, groupId: string) => {
  const groups = changedGroups.get(userId) ?? new Set<string>()
  groups.add(groupId)
  changedGroups.set(userId, groups)
}

/** The groups of this account changed before its sync started, given once. */
export const takeTabGroupsChangedBeforeSync = (userId: string): string[] => {
  const groups = changedGroups.get(userId)
  changedGroups.delete(userId)
  return groups ? [...groups] : []
}
