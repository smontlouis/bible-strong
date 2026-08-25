export const isDate = (d: unknown): d is Date => d instanceof Date
export const isEmpty = (o: object | null | undefined): boolean =>
  o ? Object.keys(o).length === 0 : true
export const isObject = (o: unknown): o is Record<string, unknown> =>
  o != null && typeof o === 'object'
export const properObject = (o: Record<string, unknown>): Record<string, unknown> =>
  isObject(o) && !o.hasOwnProperty ? { ...o } : o
