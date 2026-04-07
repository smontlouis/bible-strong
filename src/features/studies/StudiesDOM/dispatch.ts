declare global {
  interface Window {
    ReactNativeWebView: any
    ReactABI33_0_0NativeWebView: any
  }
}

export const dispatch = (type: string, payload?: any) => {
  if (!window.ReactNativeWebView) {
    window.ReactNativeWebView = window.ReactABI33_0_0NativeWebView || {
      postMessage() {},
    }
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }))
}
