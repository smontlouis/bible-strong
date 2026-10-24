// What a card can open next. Each names the tool that reads it, what to ask of it, and the
// words the same request takes in the conversation, for a host that gives a card no room
// of its own to show it.
import type { StudyLanguage } from '../../src/language'

export type Target = {
  tool: string
  args: Record<string, unknown>
  /** The request as a person would write it. */
  prompt: string
}

const say = (language: StudyLanguage, fr: string, en: string) => (language === 'fr' ? fr : en)

export const targets = (language: StudyLanguage) => ({
  passage: (osis: string, label: string, versions?: string[]): Target => ({
    tool: 'read_passage',
    args: { reference: osis, language, ...(versions?.length ? { versions } : {}) },
    prompt: say(language, `Affiche ${label}`, `Show ${label}`),
  }),
  words: (osis: string, label: string): Target => ({
    tool: 'get_verse_words',
    args: { reference: osis, language },
    prompt: say(language, `Montre ${label} mot à mot`, `Show ${label} word by word`),
  }),
  strong: (code: string, label = code): Target => ({
    tool: 'get_strong_entry',
    args: { code, language },
    prompt: say(language, `Affiche le mot Strong ${label}`, `Show the Strong word ${label}`),
  }),
  occurrences: (code: string, label: string, version?: string): Target => ({
    tool: 'find_strong_occurrences',
    args: { code, language, ...(version ? { version } : {}) },
    prompt: say(
      language,
      `Affiche les versets qui contiennent ${label}`,
      `Show the verses holding ${label}`
    ),
  }),
  commentaries: (osis: string, label: string): Target => ({
    tool: 'get_commentaries',
    args: { reference: osis, language },
    prompt: say(language, `Affiche les commentaires sur ${label}`, `Show commentaries on ${label}`),
  }),
  crossReferences: (osis: string, label: string): Target => ({
    tool: 'get_cross_references',
    args: { reference: osis, language },
    prompt: say(
      language,
      `Affiche les références croisées de ${label}`,
      `Show the cross-references of ${label}`
    ),
  }),
  dictionary: (work: string, entryId: number, word: string): Target => ({
    tool: 'get_dictionary_entry',
    args: { dictionary: work, entryId, language },
    prompt: say(
      language,
      `Affiche l’article « ${word} » du dictionnaire`,
      `Show the dictionary article “${word}”`
    ),
  }),
  topic: (name: string, label = name): Target => ({
    tool: 'get_bible_topic',
    args: { topic: name, language },
    prompt: say(language, `Affiche le thème « ${label} »`, `Show the topic “${label}”`),
  }),
  event: (slug: string, title: string): Target => ({
    tool: 'get_timeline_event',
    args: { event: slug, language },
    prompt: say(language, `Affiche l’évènement « ${title} »`, `Show the event “${title}”`),
  }),
  period: (period: number, title: string): Target => ({
    tool: 'search_timeline',
    args: { period, language, limit: 12 },
    prompt: say(
      language,
      `Affiche les évènements de la période « ${title} »`,
      `Show the events of the period “${title}”`
    ),
  }),
  entity: (uniqueName: string, name: string): Target => ({
    tool: 'get_person_or_place',
    args: { name: uniqueName, language },
    prompt: say(language, `Qui est ${name} ?`, `Who is ${name}?`),
  }),
})

export type Targets = ReturnType<typeof targets>

/** The tool a list asks for its following items. */
export const MORE_TOOLS = {
  bible_search: 'search_bible',
  strong_occurrences: 'find_strong_occurrences',
} as const
