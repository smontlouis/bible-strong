/**
 * Stable empty references to avoid creating new objects on each render.
 * Use these in useSelector fallbacks instead of inline [] or {} to prevent
 * unnecessary rerenders from reference instability.
 *
 * @example
 * // Instead of:
 * const items = useSelector(state => state.items ?? [])
 *
 * // Use:
 * const items = useSelector(state => state.items ?? EMPTY_ARRAY)
 */

export const EMPTY_ARRAY: never[] = []
export const EMPTY_OBJECT: Record<string, never> = {}
