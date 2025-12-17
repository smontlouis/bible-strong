export const deltaToPlainText = delta => {
  try {
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
  } catch (error) {
    return 'Error converting delta to plain text'
  }
}
