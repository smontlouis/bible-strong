interface DeltaOp {
  insert?: string | Record<string, unknown>
  delete?: number
  retain?: number
}

export const deltaToPlainText = (delta: DeltaOp[] | Record<string, DeltaOp>): string => {
  try {
    // handle array weird form from diff object
    const ops: DeltaOp[] = Array.isArray(delta) ? delta : Object.values(delta)
    return ops.reduce((text: string, op: DeltaOp) => {
      if (!op.insert) {
        return `${text} `
      }
      if (typeof op.insert !== 'string') {
        return `${text} `
      }
      return text + op.insert
    }, '')
  } catch {
    return 'Error converting delta to plain text'
  }
}
