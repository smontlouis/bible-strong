import * as z from 'zod/v4'
import {
  commentariesInput,
  commentariesOutput,
  commentaryListInput,
  commentaryListOutput,
  crossReferencesInput,
  crossReferencesOutput,
  loadCommentaries,
  loadCommentaryList,
  loadCrossReferences,
} from './capabilities/commentary'
import {
  dictionaryEntryInput,
  dictionaryEntryOutput,
  dictionarySearchInput,
  dictionarySearchOutput,
  loadDictionaryEntry,
  loadDictionarySearch,
} from './capabilities/dictionary'
import {
  chapterEntitiesInput,
  chapterEntitiesOutput,
  entityInput,
  entityOutput,
  loadChapterEntities,
  loadEntity,
} from './capabilities/entity'
import {
  loadNaveSearch,
  loadNaveTopic,
  loadVerseTopics,
  naveSearchInput,
  naveSearchOutput,
  naveTopicInput,
  naveTopicOutput,
  verseTopicsInput,
  verseTopicsOutput,
} from './capabilities/nave'
import {
  loadPassage,
  loadVersions,
  passageInput,
  passageOutput,
  versionsInput,
  versionsOutput,
} from './capabilities/passage'
import { loadSearch, searchInput, searchOutput } from './capabilities/search'
import {
  loadStrongEntry,
  loadStrongOccurrences,
  loadStrongSearch,
  strongEntryInput,
  strongEntryOutput,
  strongOccurrencesInput,
  strongOccurrencesOutput,
  strongSearchInput,
  strongSearchOutput,
} from './capabilities/strong'
import {
  loadTimeline,
  loadTimelineEvent,
  TIMELINE_IMAGE_ORIGIN,
  timelineEventInput,
  timelineEventOutput,
  timelineInput,
  timelineOutput,
} from './capabilities/timeline'
import { loadWords, wordsInput, wordsOutput } from './capabilities/words'
import type { CardKind } from './cards/types'
import type { StudyContext, StudyResult } from './study'

/**
 * One thing the plugin can read. It is offered to the model twice when it has a card:
 * `read` answers the model alone, for it to reason on; `show` answers the same and puts the
 * card in front of the person. The model chooses, as the card is not always wanted.
 */
export type Capability = {
  input: Record<string, z.ZodType>
  output: z.ZodObject
  load: (context: StudyContext, input: any) => Promise<StudyResult<Record<string, unknown>>>
  read: ToolText
  show?: ToolText & {
    card: CardKind
    /** What the card shows, said to the model so that it does not repeat it. */
    cardSummary: string
    /** Hosts the card reads pictures from. */
    pictures?: string[]
  }
}

type ToolText = {
  name: string
  title: string
  description: string
  /** Shown while the tool runs, and once it has answered (64 characters at most). */
  running: string
  done: string
}

const SHOWN =
  'Shows it to the user as a card; do not repeat its content in your answer, comment on it.'
const NOT_SHOWN = 'Shows nothing to the user: use it for the readings that support your answer.'

export const CAPABILITIES: readonly Capability[] = [
  {
    input: passageInput,
    output: passageOutput,
    load: loadPassage,
    read: {
      name: 'read_passage',
      title: 'Read a Bible passage',
      description:
        'Reads the text of a Bible verse, range or chapter in one to four versions, from the ' +
        'Bibles Bible Strong publishes (French, English, Hebrew, Greek, Latin). Use it whenever ' +
        `you quote or reason on Scripture, so that the wording is exact. ${NOT_SHOWN}`,
      running: 'Reading the passage',
      done: 'Passage read',
    },
    show: {
      name: 'show_passage',
      title: 'Show a Bible passage',
      description:
        'Displays a Bible verse, range or chapter, in one version or two to four versions side ' +
        'by side. Use it when a passage is what the question is about, or when the user asks ' +
        `to read, see or compare one. ${SHOWN}`,
      running: 'Opening the passage',
      done: 'Passage shown',
      card: 'passage',
      cardSummary:
        'A Bible passage with its verse numbers, in the versions asked for. The user can open ' +
        'a verse word by word, read its commentaries or open it on bible-strong.app.',
    },
  },
  {
    input: searchInput,
    output: searchOutput,
    load: loadSearch,
    read: {
      name: 'search_bible',
      title: 'Search the Bible',
      description:
        'Finds the verses of one Bible version that hold given words (mode "text"), or that ' +
        'speak of an idea without sharing its words (mode "meaning"). Use it to locate a verse ' +
        `the user half remembers, or to gather verses on a subject. ${NOT_SHOWN}`,
      running: 'Searching the Bible',
      done: 'Search done',
    },
    show: {
      name: 'show_bible_search',
      title: 'Show Bible search results',
      description:
        'Displays the verses found for a search of the Bible text, with the words found ' +
        `highlighted. Use it when the user asks to search or list verses. ${SHOWN}`,
      running: 'Searching the Bible',
      done: 'Results shown',
      card: 'bible_search',
      cardSummary: 'The verses found, with the matching words highlighted and a way to read more.',
    },
  },
  {
    input: versionsInput,
    output: versionsOutput,
    load: loadVersions,
    read: {
      name: 'list_bible_versions',
      title: 'List Bible versions',
      description:
        'Lists the Bible versions that can be read, with their code, their language and ' +
        'whether their words carry Strong numbers. Use it when the user asks which versions ' +
        'exist, or to find the code of a version before reading a passage.',
      running: 'Listing the versions',
      done: 'Versions listed',
    },
  },
  {
    input: wordsInput,
    output: wordsOutput,
    load: loadWords,
    read: {
      name: 'get_verse_words',
      title: 'Read a verse word by word',
      description:
        'Reads a verse in its original Hebrew or Greek, word by word: each word with its ' +
        'transliteration, its meaning in context, its grammatical form and its Strong number. ' +
        'Use it to explain what the original text says, before looking a word up with ' +
        `get_strong_entry. ${NOT_SHOWN}`,
      running: 'Reading the original text',
      done: 'Words read',
    },
    show: {
      name: 'show_verse_words',
      title: 'Show a verse word by word',
      description:
        'Displays a verse in its original Hebrew or Greek, each word with its transliteration ' +
        'and meaning. Use it when the user asks for the original text, an interlinear or a ' +
        `word-by-word reading. ${SHOWN}`,
      running: 'Opening the original text',
      done: 'Words shown',
      card: 'verse_words',
      cardSummary:
        'The Hebrew or Greek words of the verse in order, each with its transliteration, its ' +
        'meaning and its Strong number. The user can open the lexicon entry of a word.',
    },
  },
  {
    input: strongEntryInput,
    output: strongEntryOutput,
    load: loadStrongEntry,
    read: {
      name: 'get_strong_entry',
      title: 'Read a Strong lexicon entry',
      description:
        'Reads the lexicon entry of a Hebrew or Greek word from its Strong number: the word, ' +
        'its transliteration, its definition, the words a Bible translates it by and how many ' +
        `verses hold it. Use it to explain a word of the original text. ${NOT_SHOWN}`,
      running: 'Opening the lexicon',
      done: 'Entry read',
    },
    show: {
      name: 'show_strong_entry',
      title: 'Show a Strong lexicon entry',
      description:
        'Displays the lexicon entry of a Hebrew or Greek word from its Strong number. Use it ' +
        `when the user asks about a Strong number or the meaning of an original word. ${SHOWN}`,
      running: 'Opening the lexicon',
      done: 'Entry shown',
      card: 'strong_entry',
      cardSummary:
        'The lexicon entry: the word, its transliteration, its definition and the words that ' +
        'translate it. The user can open the verses holding it.',
    },
  },
  {
    input: strongSearchInput,
    output: strongSearchOutput,
    load: loadStrongSearch,
    read: {
      name: 'search_strong_lexicon',
      title: 'Find a word in the Strong lexicon',
      description:
        'Finds Hebrew and Greek words of the lexicon by their translation, their ' +
        'transliteration or their spelling, and gives their Strong numbers. Use it when the ' +
        'user names a word ("agape", "the Hebrew for peace") without its number.',
      running: 'Searching the lexicon',
      done: 'Words found',
    },
  },
  {
    input: strongOccurrencesInput,
    output: strongOccurrencesOutput,
    load: loadStrongOccurrences,
    read: {
      name: 'find_strong_occurrences',
      title: 'Find the verses holding a Strong word',
      description:
        'Lists the verses where a Hebrew or Greek word appears, from its Strong number, with ' +
        'the words that translate it in each verse and its count by book. Use it to study how ' +
        `a word is used across the Bible. ${NOT_SHOWN}`,
      running: 'Looking for the verses',
      done: 'Verses found',
    },
    show: {
      name: 'show_strong_occurrences',
      title: 'Show the verses holding a Strong word',
      description:
        'Displays the concordance of a Hebrew or Greek word: the verses where it appears, with ' +
        `its translation highlighted. Use it when the user asks where a word is used. ${SHOWN}`,
      running: 'Opening the concordance',
      done: 'Concordance shown',
      card: 'strong_occurrences',
      cardSummary:
        'The verses holding the word, its translation highlighted in each, with a way to read more.',
    },
  },
  {
    input: dictionarySearchInput,
    output: dictionarySearchOutput,
    load: loadDictionarySearch,
    read: {
      name: 'search_dictionaries',
      title: 'Find a Bible dictionary article',
      description:
        'Finds the headings of the Bible dictionaries that match a word or a name, and the ' +
        'dictionaries holding each. Use it before get_dictionary_entry when a heading is not ' +
        'found, or to see which dictionaries write about a notion.',
      running: 'Searching the dictionaries',
      done: 'Headings found',
    },
  },
  {
    input: dictionaryEntryInput,
    output: dictionaryEntryOutput,
    load: loadDictionaryEntry,
    read: {
      name: 'get_dictionary_entry',
      title: 'Read a Bible dictionary article',
      description:
        'Reads the article of a Bible dictionary on a person, a place, a custom or a notion ' +
        '(Westphal, Bost, Easton, Smith, ISBE and others). Use it for background the Bible ' +
        `text does not give by itself. ${NOT_SHOWN}`,
      running: 'Opening the dictionary',
      done: 'Article read',
    },
    show: {
      name: 'show_dictionary_entry',
      title: 'Show a Bible dictionary article',
      description:
        'Displays the article of a Bible dictionary on a person, a place, a custom or a ' +
        'notion. Use it when the user asks what a custom, an object or a notion of the Bible ' +
        `is, or what a dictionary says. ${SHOWN}`,
      running: 'Opening the dictionary',
      done: 'Article shown',
      card: 'dictionary_entry',
      cardSummary:
        'The dictionary article, with links to the passages it cites and to the same notion in ' +
        'other dictionaries.',
    },
  },
  {
    input: naveSearchInput,
    output: naveSearchOutput,
    load: loadNaveSearch,
    read: {
      name: 'search_bible_topics',
      title: 'Find a topic of the topical Bible',
      description:
        "Finds the topics of Nave's Topical Bible whose name matches a word. Use it to find " +
        'the topic that gathers the passages on a subject, before get_bible_topic.',
      running: 'Searching the topics',
      done: 'Topics found',
    },
  },
  {
    input: naveTopicInput,
    output: naveTopicOutput,
    load: loadNaveTopic,
    read: {
      name: 'get_bible_topic',
      title: 'Read a topic of the topical Bible',
      description:
        "Reads a topic of Nave's Topical Bible: its sub-topics and the Bible passages filed " +
        'under each. Use it to gather what the Bible says on a subject, by theme rather than ' +
        `by word. ${NOT_SHOWN}`,
      running: 'Opening the topic',
      done: 'Topic read',
    },
    show: {
      name: 'show_bible_topic',
      title: 'Show a topic of the topical Bible',
      description:
        "Displays a topic of Nave's Topical Bible, with its sub-topics and their passages. " +
        `Use it when the user asks for the passages on a subject. ${SHOWN}`,
      running: 'Opening the topic',
      done: 'Topic shown',
      card: 'nave_topic',
      cardSummary: 'The outline of the topic: its sub-topics and the passages under each.',
    },
  },
  {
    input: verseTopicsInput,
    output: verseTopicsOutput,
    load: loadVerseTopics,
    read: {
      name: 'list_verse_topics',
      title: 'List the topics citing a verse',
      description:
        "Lists the topics of Nave's Topical Bible that cite a verse or its chapter. Use it to " +
        'see which themes a verse belongs to.',
      running: 'Looking for the topics',
      done: 'Topics listed',
    },
  },
  {
    input: commentaryListInput,
    output: commentaryListOutput,
    load: loadCommentaryList,
    read: {
      name: 'list_commentaries',
      title: 'List the Bible commentaries',
      description:
        'Lists the Bible commentaries that can be read in a language, with their author and ' +
        'what each is. Use it when the user asks which commentaries exist, or names an author.',
      running: 'Listing the commentaries',
      done: 'Commentaries listed',
    },
  },
  {
    input: commentariesInput,
    output: commentariesOutput,
    load: loadCommentaries,
    read: {
      name: 'get_commentaries',
      title: 'Read commentaries on a verse',
      description:
        'Reads what Bible commentaries say on a verse (Matthew Henry, Barnes, Calvin, Clarke, ' +
        'the Bible annotée and others), each with its author. Use it to report how a verse has ' +
        `been understood, naming who says what. ${NOT_SHOWN}`,
      running: 'Opening the commentaries',
      done: 'Commentaries read',
    },
    show: {
      name: 'show_commentaries',
      title: 'Show commentaries on a verse',
      description:
        'Displays what Bible commentaries say on a verse, one after the other. Use it when ' +
        `the user asks how a verse has been understood, or for commentaries on it. ${SHOWN}`,
      running: 'Opening the commentaries',
      done: 'Commentaries shown',
      card: 'commentaries',
      cardSummary: 'The verse, then what each commentary says on it, with its author.',
    },
  },
  {
    input: crossReferencesInput,
    output: crossReferencesOutput,
    load: loadCrossReferences,
    read: {
      name: 'get_cross_references',
      title: 'Read the cross-references of a verse',
      description:
        'Reads the verses that the Treasury of Scripture Knowledge links to a verse, grouped ' +
        'by the words they echo, with their text. Use it to let Scripture explain Scripture. ' +
        `${NOT_SHOWN}`,
      running: 'Looking for the references',
      done: 'References read',
    },
    show: {
      name: 'show_cross_references',
      title: 'Show the cross-references of a verse',
      description:
        'Displays the verses linked to a verse, with their text. Use it when the user asks ' +
        `for cross-references or parallel verses. ${SHOWN}`,
      running: 'Looking for the references',
      done: 'References shown',
      card: 'cross_references',
      cardSummary: 'The verses linked to the verse, with their text, grouped by the words they echo.',
    },
  },
  {
    input: timelineInput,
    output: timelineOutput,
    load: loadTimeline,
    read: {
      name: 'search_timeline',
      title: 'Find events of the biblical timeline',
      description:
        'Finds dated events of biblical and church history, by words or by one of the 13 ' +
        'periods; without either, lists the periods. Use it to place a person or a fact in ' +
        `time. ${NOT_SHOWN}`,
      running: 'Reading the timeline',
      done: 'Events found',
    },
    show: {
      name: 'show_timeline',
      title: 'Show events of the biblical timeline',
      description:
        'Displays dated events of biblical and church history, with their pictures, by words ' +
        'or by period. Use it when the user asks when something happened or for the events of ' +
        `a period. ${SHOWN}`,
      running: 'Opening the timeline',
      done: 'Timeline shown',
      card: 'timeline',
      cardSummary: 'The events found, each with its dates and its picture.',
      pictures: [TIMELINE_IMAGE_ORIGIN],
    },
  },
  {
    input: timelineEventInput,
    output: timelineEventOutput,
    load: loadTimelineEvent,
    read: {
      name: 'get_timeline_event',
      title: 'Read an event of the biblical timeline',
      description:
        'Reads one event of the biblical timeline: its dates, its period, its article and the ' +
        `passages that tell it. Use it for the history around a passage. ${NOT_SHOWN}`,
      running: 'Opening the event',
      done: 'Event read',
    },
    show: {
      name: 'show_timeline_event',
      title: 'Show an event of the biblical timeline',
      description:
        'Displays one event of the biblical timeline, with its picture, its dates and its ' +
        `article. Use it when the user asks about a dated event. ${SHOWN}`,
      running: 'Opening the event',
      done: 'Event shown',
      card: 'timeline_event',
      cardSummary: 'The event: its picture, its dates, its article and the passages that tell it.',
      pictures: [TIMELINE_IMAGE_ORIGIN],
    },
  },
  {
    input: entityInput,
    output: entityOutput,
    load: loadEntity,
    read: {
      name: 'get_person_or_place',
      title: 'Read about a person or a place of the Bible',
      description:
        'Reads who a person of the Bible is or where a place is: a description, their family ' +
        'or the area and coordinates, and the Hebrew or Greek names they bear. Use it to tell ' +
        `namesakes apart and to give family relations. ${NOT_SHOWN}`,
      running: 'Looking them up',
      done: 'Profile read',
    },
    show: {
      name: 'show_person_or_place',
      title: 'Show a person or a place of the Bible',
      description:
        'Displays the profile of a person or a place of the Bible, with their family ' +
        `relations or their location. Use it when the user asks who someone was or where a place is. ${SHOWN}`,
      running: 'Looking them up',
      done: 'Profile shown',
      card: 'entity',
      cardSummary: 'The profile: a description, the family relations or the location.',
    },
  },
  {
    input: chapterEntitiesInput,
    output: chapterEntitiesOutput,
    load: loadChapterEntities,
    read: {
      name: 'list_chapter_people_and_places',
      title: 'List the people and places of a chapter',
      description:
        'Lists the people, places and peoples named in a chapter, with the verses naming ' +
        'each. Use it to find who is who in a passage before get_person_or_place.',
      running: 'Reading the chapter',
      done: 'Names listed',
    },
  },
]

/** The tool a card asks for more of the same kind of content: the one that shows nothing. */
export const READ_TOOL_OF_CARD: Record<CardKind, string> = Object.fromEntries(
  CAPABILITIES.flatMap(capability =>
    capability.show ? [[capability.show.card, capability.read.name]] : []
  )
) as Record<CardKind, string>
