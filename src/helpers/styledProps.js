export const bindStyles = map =>
  Object.keys(map).reduce((memo, key) => {
    memo[key] = styledProps(map[key], key)
    return memo
  }, {})

const styledProps = (map, fallback) => props => {
  const keysFromProps = Object.keys(map).filter(key => !!props[key])
  if (keysFromProps.length > 1) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(
        `[styledProps] Multiple props provided: ${keysFromProps.join(', ')}.`
      )
    }
  }
  const keyFromProps = keysFromProps[0]
  if (map[keyFromProps] !== undefined) {
    return map[keyFromProps]
  }
  if (fallback) {
    if (props[fallback] && map[props[fallback]] !== undefined) {
      return map[props[fallback]]
    }
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(
        `[styledProps] Unknown fallback prop provided: ${fallback}.`
      )
    }
  }
  return undefined
}

export default styledProps
