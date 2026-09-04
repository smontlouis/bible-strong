const noop = () => undefined
const scope = {
  setContext: noop,
  setExtra: noop,
  setLevel: noop,
  setTag: noop,
  setUser: noop,
}

module.exports = {
  addBreadcrumb: noop,
  captureException: noop,
  getCurrentScope: () => scope,
  init: noop,
  wrap: component => component,
  withScope: callback => callback(scope),
}
