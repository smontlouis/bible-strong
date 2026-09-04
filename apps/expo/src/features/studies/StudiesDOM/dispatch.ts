import type { JSONValue } from 'expo/build/dom/dom.types'

interface WebViewBridge {
  postMessage(message: string): void
}

declare global {
  interface Window {
    ReactNativeWebView?: WebViewBridge
    ReactABI33_0_0NativeWebView?: WebViewBridge
  }
}

export const dispatch = (type: string, payload?: JSONValue) => {
  if (!window.ReactNativeWebView) {
    window.ReactNativeWebView = window.ReactABI33_0_0NativeWebView || {
      postMessage() {},
    }
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }))
}
