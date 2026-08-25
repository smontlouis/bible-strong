type StyleMap = Record<string, unknown>

export const bindStyles = (map: Record<string, StyleMap>) =>
  Object.keys(map).reduce<Record<string, ReturnType<typeof styledProps>>>((memo, key) => {
    memo[key] = styledProps(map[key], key)
    return memo
  }, {})

const styledProps = (map: StyleMap, fallback?: string) => (props: Record<string, unknown>) => {
  const keysFromProps = Object.keys(map).filter(key => !!props[key])
  if (keysFromProps.length > 1) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[styledProps] Multiple props provided: ${keysFromProps.join(', ')}.`)
    }
  }
  const keyFromProps = keysFromProps[0]
  if (map[keyFromProps] !== undefined) {
    return map[keyFromProps]
  }
  if (fallback) {
    if (props[fallback] && map[props[fallback] as string] !== undefined) {
      return map[props[fallback] as string]
    }
  }
  return undefined
}

export default styledProps
