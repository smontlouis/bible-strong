describe('Array.prototype.at on a WebView without it', () => {
  const native = Array.prototype.at

  beforeEach(() => {
    Reflect.deleteProperty(Array.prototype, 'at')
    jest.isolateModules(() => {
      require('../arrayAtPolyfill')
    })
  })

  afterEach(() => {
    Object.defineProperty(Array.prototype, 'at', {
      value: native,
      configurable: true,
      writable: true,
    })
  })

  it('reads from either end, like the native method', () => {
    expect(['a', 'b', 'c'].at(0)).toBe('a')
    expect(['a', 'b', 'c'].at(-1)).toBe('c')
    expect(['a', 'b', 'c'].at(3)).toBeUndefined()
    expect(['a', 'b', 'c'].at(-4)).toBeUndefined()
    expect(['a', 'b', 'c'].at(1.7)).toBe('b')
  })

  it('does not show up when iterating an array', () => {
    const keys: string[] = []
    for (const key in ['a']) keys.push(key)
    expect(keys).toEqual(['0'])
  })
})
