export const isDate = d => d instanceof Date
export const isEmpty = o => (o ? Object.keys(o).length === 0 : true)
export const isObject = o => o != null && typeof o === 'object'
export const properObject = o => (isObject(o) && !o.hasOwnProperty ? { ...o } : o)
