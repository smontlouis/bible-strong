export const deltaToPlainText = delta => {
  // handle array weird form from diff object
  delta = Array.isArray(delta) ? delta : Object.values(delta)
  return delta.reduce((text, op) => {
    if (!op.insert) {
      return `${text} `
    }
    if (typeof op.insert !== 'string') {
      return `${text} `
    }
    return text + op.insert
  }, '')
}
