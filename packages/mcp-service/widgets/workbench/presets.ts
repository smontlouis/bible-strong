/** Requests worth looking at: the ordinary case of each card, and the ones that strain it. */
export type Preset = { tool: string; label: string; args: Record<string, unknown> }

export const presets: Preset[] = [
  { tool: 'show_passage', label: 'One verse', args: { reference: 'Jean 3:16', language: 'fr' } },
  { tool: 'show_passage', label: 'A few verses', args: { reference: 'Romains 8:28-32', language: 'fr' } },
  { tool: 'show_passage', label: 'A chapter with titles', args: { reference: 'Matthieu 5', versions: ['S21'], language: 'fr' } },
  { tool: 'show_passage', label: 'Poetry', args: { reference: 'Psalm 23', versions: ['ESV'], language: 'en' } },
  { tool: 'show_passage', label: 'Two versions', args: { reference: 'Jean 1:1-5', versions: ['LSG', 'S21'], language: 'fr' } },
  { tool: 'show_passage', label: 'Four versions', args: { reference: 'John 3:16', versions: ['KJV', 'ESV', 'NIV', 'NLT'], language: 'en' } },
  { tool: 'show_passage', label: 'Hebrew', args: { reference: 'Genèse 1:1-3', versions: ['BHS', 'LSG'], language: 'fr' } },
  { tool: 'show_passage', label: 'A version without the passage', args: { reference: 'Matthieu 5:3', versions: ['BHS', 'SBLGNT'], language: 'fr' } },
  { tool: 'show_passage', label: 'Not a reference', args: { reference: 'bonjour', language: 'fr' } },

  { tool: 'show_bible_search', label: 'Words', args: { query: 'amour de Dieu', language: 'fr' } },
  { tool: 'show_bible_search', label: 'By meaning', args: { query: 'finding peace when anxious', mode: 'meaning', language: 'en' } },
  { tool: 'show_bible_search', label: 'Nothing found', args: { query: 'xyzzyqq', language: 'fr' } },

  { tool: 'show_verse_words', label: 'Greek', args: { reference: 'Jean 3:16', language: 'fr' } },
  { tool: 'show_verse_words', label: 'Hebrew', args: { reference: 'Genesis 1:1', language: 'en' } },
  { tool: 'show_verse_words', label: 'Three verses', args: { reference: 'Psaume 23:1-3', language: 'fr' } },

  { tool: 'show_strong_entry', label: 'Greek word', args: { code: 'G26', language: 'fr' } },
  { tool: 'show_strong_entry', label: 'Hebrew word', args: { code: 'H430', language: 'en' } },
  { tool: 'show_strong_entry', label: 'A name', args: { code: 'H85', language: 'fr' } },
  { tool: 'show_strong_entry', label: 'Unknown number', args: { code: 'G99999', language: 'fr' } },

  { tool: 'show_strong_occurrences', label: 'In the whole Bible', args: { code: 'G26', language: 'fr' } },
  { tool: 'show_strong_occurrences', label: 'In one book', args: { code: 'H7965', book: 'Psaumes', language: 'fr' } },

  { tool: 'show_dictionary_entry', label: 'French article', args: { word: 'Alliance', language: 'fr' } },
  { tool: 'show_dictionary_entry', label: 'English article', args: { word: 'Covenant', language: 'en' } },

  { tool: 'show_bible_topic', label: 'French topic', args: { topic: 'Amour', language: 'fr' } },
  { tool: 'show_bible_topic', label: 'English topic', args: { topic: 'faith', language: 'en' } },

  { tool: 'show_commentaries', label: 'French', args: { reference: 'Jean 3:16', language: 'fr' } },
  { tool: 'show_commentaries', label: 'English', args: { reference: 'Psalm 23:1', language: 'en' } },

  { tool: 'show_cross_references', label: 'A verse', args: { reference: 'Jean 3:16', language: 'fr' } },

  { tool: 'show_timeline', label: 'The periods', args: { language: 'fr' } },
  { tool: 'show_timeline', label: 'Events by words', args: { query: 'Paul', language: 'fr' } },
  { tool: 'show_timeline', label: 'Events of a period', args: { period: 9, language: 'en' } },

  { tool: 'show_timeline_event', label: 'An event', args: { event: 'conversion-of-paul', language: 'fr' } },

  { tool: 'show_person_or_place', label: 'A person', args: { name: 'Abraham', language: 'fr' } },
  { tool: 'show_person_or_place', label: 'A place', args: { name: 'Bethel', language: 'en' } },
]
