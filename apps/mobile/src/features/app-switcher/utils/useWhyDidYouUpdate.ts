import { useRef, useEffect } from 'react'

type TrackedProps = Record<string, unknown>
type Changes = Record<string, { from: unknown; to: unknown }>

export default function useWhyDidYouUpdate(name: string, props: TrackedProps) {
  // Get a mutable ref object where we can store props ...
  // ... for comparison next time this hook runs.
  const previousProps = useRef<TrackedProps | null>(null)
  useEffect(() => {
    const previous = previousProps.current
    if (previous) {
      // Get all keys from previous and current props
      const allKeys = Object.keys({ ...previous, ...props })
      // Use this object to keep track of changed props
      const changesObj: Changes = {}
      // Iterate through keys
      allKeys.forEach(key => {
        // If previous is different from current
        if (previous[key] !== props[key]) {
          // Add to changesObj
          changesObj[key] = {
            from: previous[key],
            to: props[key],
          }
        }
      })
      // If changesObj not empty then output to console
      if (Object.keys(changesObj).length) {
        console.log('[AppSwitcher] why-did-you-update:', name, changesObj)
      }
    }
    // Finally update previousProps with current props for next hook call
    previousProps.current = props
  })
}
