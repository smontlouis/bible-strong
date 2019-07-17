export const dispatch = (type, payload) => {
  window.postMessage(JSON.stringify({ type, payload }), '*')
}

export const dispatchConsole = (payload) => {
  dispatch('CONSOLE_LOG', payload)
}
