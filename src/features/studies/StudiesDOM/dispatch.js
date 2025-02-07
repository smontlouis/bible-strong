export const dispatch = (type, payload) => {
  if (!window.ReactNativeWebView) {
    window.ReactNativeWebView = window.ReactABI33_0_0NativeWebView || {
      postMessage() {},
    }
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }))
}
