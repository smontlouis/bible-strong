import {
  initialStoryState,
  storyActionForKey,
  storyReducer,
  storyStepNumber,
  type StoryAction,
  type StoryState,
} from '../storyMachine'

const key = (key: string, extra: Partial<KeyboardEvent> = {}) =>
  ({
    key,
    code: /^[a-z]$/i.test(key)
      ? `Key${key.toUpperCase()}`
      : /^[0-9]$/.test(key)
        ? `Digit${key}`
        : key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...extra,
  }) as KeyboardEvent

const play = (actions: StoryAction[], state: StoryState = initialStoryState) =>
  actions.reduce(storyReducer, state)

const press = (event: KeyboardEvent) => storyActionForKey(event, true)!

describe('storyActionForKey', () => {
  it('reads the reader’s keys through the keymap', () => {
    expect(press(key('j'))).toEqual({ type: 'shortcut', id: 'nextVerse' })
    expect(press(key('s'))).toEqual({ type: 'shortcut', id: 'lexicon' })
    expect(press(key('R', { shiftKey: true }))).toEqual({ type: 'shortcut', id: 'relation' })
    expect(press(key('C', { shiftKey: true }))).toEqual({ type: 'shortcut', id: 'commentary' })
    expect(press(key('Escape'))).toEqual({ type: 'shortcut', id: 'deselect' })
  })

  it('takes the digit of the key, AZERTY included', () => {
    expect(press(key('é', { code: 'Digit2' }))).toEqual({
      type: 'shortcut',
      id: 'highlight',
      digit: 2,
    })
  })

  it('leaves the palette and the browser their chords', () => {
    expect(storyActionForKey(key('k', { metaKey: true }), true)).toBeUndefined()
    expect(storyActionForKey(key('Enter', { metaKey: true }), true)).toBeUndefined()
  })

  it('goes on with Enter and back with Shift Enter', () => {
    expect(press(key('Enter'))).toEqual({ type: 'next' })
    expect(press(key('Enter', { shiftKey: true }))).toEqual({ type: 'back' })
  })
})

describe('storyReducer', () => {
  it('asks for a selection before a highlight', () => {
    const state = play([{ type: 'shortcut', id: 'highlight', digit: 3 }])
    expect(state.color).toBeUndefined()
    expect(state.nudge).toEqual({ key: 'nextVerse', count: 1 })
  })

  it('highlights the selected verse in the colour of the digit', () => {
    const state = play([
      { type: 'shortcut', id: 'nextVerse' },
      { type: 'shortcut', id: 'highlight', digit: 4 },
    ])
    expect(state.color).toBe('color4')
    expect(state.nudge).toBeUndefined()
  })

  it('changes the style of a highlight, never of a verse not yet highlighted', () => {
    const selected = play([{ type: 'shortcut', id: 'nextVerse' }])
    expect(play([{ type: 'highlightType', value: 'underline' }], selected).highlightType).toBe(
      'background'
    )
    const highlighted = play([{ type: 'shortcut', id: 'highlight', digit: 2 }], selected)
    expect(play([{ type: 'highlightType', value: 'underline' }], highlighted).highlightType).toBe(
      'underline'
    )
  })

  it('does the step the default way when the reader continues without its key', () => {
    const tools = play([{ type: 'next' }])
    expect(tools).toMatchObject({ step: 'tools', selected: true, color: 'color1' })
    expect(play([{ type: 'next' }], tools)).toMatchObject({ step: 'strong', tool: 'lexicon' })
  })

  it('keeps the colour the reader chose when continuing', () => {
    const state = play([
      { type: 'shortcut', id: 'nextVerse' },
      { type: 'shortcut', id: 'highlight', digit: 3 },
      { type: 'next' },
    ])
    expect(state).toMatchObject({ step: 'tools', color: 'color3' })
  })

  it('reaches the end on Continue alone, every step done', () => {
    const state = play(Array.from({ length: 7 }, () => ({ type: 'next' }) as const))
    expect(state).toMatchObject({
      step: 'finish',
      color: 'color1',
      tool: 'lexicon',
      noted: true,
      related: true,
      returned: true,
    })
    expect(play([{ type: 'next' }], state).step).toBe('finish')
  })

  it('lights the other tools and opens the lexicon on S', () => {
    const tools = play([
      { type: 'shortcut', id: 'nextVerse' },
      { type: 'shortcut', id: 'highlight', digit: 1 },
      { type: 'next' },
      { type: 'shortcut', id: 'dictionary' },
    ])
    expect(tools).toMatchObject({ step: 'tools', tool: 'dictionary' })
    expect(play([{ type: 'shortcut', id: 'lexicon' }], tools)).toMatchObject({
      step: 'strong',
      tool: 'lexicon',
    })
  })

  it('plays the whole story to its end', () => {
    const state = play([
      { type: 'shortcut', id: 'nextVerse' },
      { type: 'shortcut', id: 'highlight', digit: 2 },
      { type: 'next' },
      { type: 'shortcut', id: 'lexicon' },
      { type: 'word', word: 'common' },
      { type: 'next' },
      { type: 'filter', filter: 'breath' },
      { type: 'next' },
      { type: 'shortcut', id: 'note' },
      { type: 'shortcut', id: 'tags' },
      { type: 'next' },
      { type: 'shortcut', id: 'relation' },
      { type: 'next' },
      { type: 'shortcut', id: 'deselect' },
      { type: 'next' },
    ])
    expect(state).toMatchObject({
      step: 'finish',
      color: 'color2',
      word: 'common',
      filter: 'breath',
      noted: true,
      tagged: true,
      related: true,
      returned: true,
    })
    expect(storyStepNumber(state.step)).toBe(7)
  })

  it('tags only a note that exists', () => {
    const atNote = { ...initialStoryState, step: 'note' as const }
    expect(play([{ type: 'shortcut', id: 'tags' }], atNote)).toMatchObject({
      tagged: false,
      nudge: { key: 'note', count: 1 },
    })
  })

  it('undoes the lexicon when going back to the tools', () => {
    const atStrong = { ...initialStoryState, step: 'strong' as const, tool: 'lexicon' as const }
    expect(play([{ type: 'back' }], atStrong)).toMatchObject({ step: 'tools', tool: undefined })
  })

  it('stays on the first step when going back', () => {
    expect(play([{ type: 'back' }]).step).toBe('highlight')
  })
})

describe("Strobi's step", () => {
  const withStrobi = play([{ type: 'steps', withStrobi: true }])
  const atStrobi = play(
    [{ type: 'next' }, { type: 'next' }, { type: 'next' }, { type: 'next' }],
    withStrobi
  )

  it('comes after the occurrences when Remote Config opens the assistant', () => {
    expect(atStrobi.step).toBe('strobi')
    expect(storyStepNumber(atStrobi.step, atStrobi.steps)).toBe(5)
    expect(storyStepNumber('finish', atStrobi.steps)).toBe(8)
  })

  it('is decided on the first step only', () => {
    const atTools = play([{ type: 'next' }])
    expect(play([{ type: 'steps', withStrobi: true }], atTools).steps).not.toContain('strobi')
  })

  it('asks on Continue, waits for the answer, then goes on to the note', () => {
    const thinking = play([{ type: 'next' }], atStrobi)
    expect(thinking).toMatchObject({ step: 'strobi', strobi: 'thinking' })
    expect(play([{ type: 'next' }], thinking).step).toBe('strobi')
    const answered = play([{ type: 'strobiAnswered' }], thinking)
    expect(answered.strobi).toBe('answer')
    expect(play([{ type: 'next' }], answered).step).toBe('note')
  })

  it('records the wish to try Strobi only once it has answered', () => {
    expect(play([{ type: 'tryStrobi' }], atStrobi).strobi).toBe('question')
    expect(
      play([{ type: 'askStrobi' }, { type: 'strobiAnswered' }, { type: 'tryStrobi' }], atStrobi)
        .strobi
    ).toBe('accepted')
  })

  it('keeps the story of seven steps without it', () => {
    const atNote = play([{ type: 'next' }, { type: 'next' }, { type: 'next' }, { type: 'next' }])
    expect(atNote.step).toBe('note')
  })
})
