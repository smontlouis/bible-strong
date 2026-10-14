import './styles.css'
import { render } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import type { Card } from '../../src/cards/types'
import { BibleSearch, CrossReferences, Passage } from './cards/bible'
import { Commentaries, DictionaryEntry, NaveTopic } from './cards/editorial'
import { Entity, Timeline, TimelineEvent } from './cards/history'
import { StrongEntry, StrongOccurrences, VerseWords } from './cards/strong'
import { createHost, type Host } from './host'
import { cardLanguageOf, messagesFor } from './i18n'
import { targets } from './targets'
import { Context } from './ui'

const CardView = ({ card }: { card: Card }) => {
  switch (card.kind) {
    case 'passage':
      return <Passage card={card} />
    case 'bible_search':
      return <BibleSearch card={card} />
    case 'cross_references':
      return <CrossReferences card={card} />
    case 'verse_words':
      return <VerseWords card={card} />
    case 'strong_entry':
      return <StrongEntry card={card} />
    case 'strong_occurrences':
      return <StrongOccurrences card={card} />
    case 'dictionary_entry':
      return <DictionaryEntry card={card} />
    case 'nave_topic':
      return <NaveTopic card={card} />
    case 'commentaries':
      return <Commentaries card={card} />
    case 'timeline':
      return <Timeline card={card} />
    case 'timeline_event':
      return <TimelineEvent card={card} />
    case 'entity':
      return <Entity card={card} />
  }
}

const App = ({ host }: { host: Host }) => {
  const [state, setState] = useState(host.state())
  useEffect(() => {
    const follow = () => setState(host.state())
    const leave = host.subscribe(follow)
    // A host may hand the result over before this runs: what was missed is caught up.
    follow()
    return () => void leave()
  }, [host])

  const { view } = state
  if (view.status === 'waiting') {
    return (
      <div class="state" role="status" aria-live="polite">
        <span class="skeleton" />
        <span class="skeleton" />
        <span class="skeleton" />
      </div>
    )
  }
  if (view.status === 'text') {
    // Nothing to draw. What went wrong is the model's to explain, in its own words; a host
    // that hands no card over is given the answer as it was written for the model.
    const t = messagesFor(state.locale.toLowerCase().startsWith('fr') ? 'fr' : 'en')
    return <p class="state">{view.failed ? t.failed : view.message || t.nothing}</p>
  }

  const card = view.stack.at(-1)!
  const language = cardLanguageOf(card.language)
  return (
    <Context.Provider
      value={{
        host,
        state,
        t: messagesFor(language),
        go: targets(language),
        canGoBack: view.stack.length > 1,
      }}
    >
      {/* A card opened from another starts afresh: nothing picked, nothing unfolded. */}
      <CardView key={`${view.stack.length}:${card.kind}:${card.title}`} card={card} />
    </Context.Provider>
  )
}

render(<App host={createHost()} />, document.getElementById('root')!)
