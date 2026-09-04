export const getBibleDOMDestination = (tabId: string) => `bible-dom-${tabId}`

// React Native Teleport only amortizes native WebView startup. On web, each
// Bible tab owns its inline HTML tree, so there is nothing to pre-warm or move.
const SharedBibleDOM = () => null

export default SharedBibleDOM
